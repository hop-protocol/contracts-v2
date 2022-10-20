//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "../utils/Lib_MerkleTree.sol";
import "../interfaces/ICrossChainSource.sol";
import "../interfaces/IHubMessageBridge.sol";
import "../interfaces/ISpokeMessageBridge.sol";

struct Route {
    uint256 chainId;
    uint256 messageFee;
    uint256 maxBundleMessages;
}

contract SpokeMessageBridge is MessageBridge, ISpokeMessageBridge {
    using Lib_MerkleTree for bytes32;

    /* events */
    event FeesSentToHub(uint256 amount);
    event MessageBundled(
        bytes32 indexed bundleId,
        uint256 indexed treeIndex,
        bytes32 indexed messageId
    );
    event BundleCommitted(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 toChainId,
        uint256 commitTime
    );

    /* constants */
    uint256 public immutable hubChainId;

    /* config*/
    IHubMessageBridge public hubBridge; // ToDo: Consider making immutable
    address public hubFeeDistributor;
    uint256 public pendingFeeBatchSize;
    mapping(uint256 => uint256) public routeMessageFee;
    mapping(uint256 => uint256) public routeMaxBundleMessages;

    /* state */
    mapping(uint256 => bytes32) public pendingBundleIdForChainId;
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingFeesForChainId;
    uint256 public totalFeesForHub;

    modifier onlyHub() {
        if (msg.sender != address(hubBridge)) {
            revert NotHubBridge(msg.sender);
        }
        _;
    }

    constructor(
        uint256 _hubChainId, 
        IHubMessageBridge _hubBridge, 
        address _hubFeeDistributor, 
        Route[] memory routes
    ) {
        if (_hubChainId == 0) revert NoZeroChainId();
        hubChainId = _hubChainId;
        setHomeBridge(_hubBridge, _hubFeeDistributor);
        for (uint256 i = 0; i < routes.length; i++) {
            Route memory route = routes[i];
            setRoute(route);
        }
    }

    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        external
        payable
    {
        uint256 maxBundleMessages = routeMaxBundleMessages[toChainId];
        if (maxBundleMessages == 0) {
            revert InvalidRoute(toChainId);
        }

        uint256 messageFee = routeMessageFee[toChainId];
        if (messageFee != msg.value) {
            revert IncorrectFee(messageFee, msg.value);
        }

        uint256 fromChainId = getChainId();
        bytes32 pendingBundleId = pendingBundleIdForChainId[toChainId];
        bytes32[] storage pendingMessageIds = pendingMessageIdsForChainId[toChainId];

        uint256 treeIndex = pendingMessageIds.length;
        bytes32 messageId = getSpokeMessageId(
            pendingBundleId,
            treeIndex,
            fromChainId,
            msg.sender,
            toChainId,
            to,
            data
        );

        pendingMessageIds.push(messageId);
        pendingFeesForChainId[toChainId] += messageFee;

        emit MessageBundled(pendingBundleId, treeIndex, messageId);
        emit MessageSent(messageId, msg.sender, toChainId, to, data);

        if (pendingMessageIds.length >= maxBundleMessages) {
            _commitPendingBundle(toChainId);
        }
    }

    function commitPendingBundle(uint256 toChainId) external payable {
        if (pendingMessageIdsForChainId[toChainId].length == 0) revert NoPendingBundle();

        uint256 totalFees = pendingFeesForChainId[toChainId] + msg.value;
        uint256 messageFee = routeMessageFee[toChainId];
        uint256 numMessages = routeMaxBundleMessages[toChainId];
        uint256 fullBundleFee = messageFee * numMessages;
        if (fullBundleFee > totalFees) {
            revert NotEnoughFees(fullBundleFee, totalFees);
        }
        _commitPendingBundle(toChainId);
    }

    function _commitPendingBundle(uint256 toChainId) private {
        bytes32[] storage pendingMessageIds = pendingMessageIdsForChainId[toChainId];
        if (pendingMessageIds.length == 0) {
            return;
        }

        bytes32 bundleId = pendingBundleIdForChainId[toChainId];
        bytes32 bundleRoot = Lib_MerkleTree.getMerkleRoot(pendingMessageIds);
        uint256 bundleFees = pendingFeesForChainId[toChainId];

        // New pending bundle
        pendingBundleIdForChainId[toChainId] = bytes32(uint256(pendingBundleIdForChainId[toChainId]) + 1);
        delete pendingMessageIdsForChainId[toChainId];
        pendingFeesForChainId[toChainId] = 0;

        emit BundleCommitted(bundleId, bundleRoot, bundleFees, toChainId, block.timestamp);

        hubBridge.receiveOrForwardMessageBundle(
            bundleId,
            bundleRoot,
            bundleFees,
            toChainId,
            block.timestamp
        );

        // Collect fees
        totalFeesForHub += bundleFees;
        uint256 _totalFeesForHub = totalFeesForHub;
        if (_totalFeesForHub >= pendingFeeBatchSize) {
            // Send fees to l1
            totalFeesForHub = 0;
            _sendFeesToHub(_totalFeesForHub);
        }
    }

    function receiveMessageBundle(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 fromChainId
    )
        external
        payable
        onlyHub
    {
        bundles[bundleId] = ConfirmedBundle(bundleRoot, fromChainId);
    }

    function forwardMessage(address from, address to, bytes calldata data) external onlyHub {
        bytes32 messageId = bytes32(0); // ToDo: L1 -> L2 message id
        _relayMessage(messageId, hubChainId, from, to, data);
    }

    /* Setters */

    function setHomeBridge(IHubMessageBridge _hubBridge, address _hubFeeDistributor) public onlyOwner {
        if (address(_hubBridge) == address(0)) revert NoZeroAddress();
        if (_hubFeeDistributor == address(0)) revert NoZeroAddress();

        hubBridge = _hubBridge;
        hubFeeDistributor = _hubFeeDistributor;
    }

    // ToDo: Set in constructor
    /// @notice `pendingFeeBatchSize` of 0 will flush the pending fees for every bundle.
    function setpendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }

    function setRoute(Route memory route) public onlyOwner {
        if (route.chainId == 0) revert NoZeroChainId();
        if (route.messageFee == 0) revert NoZeroMessageFee();
        if (route.maxBundleMessages == 0) revert NoZeroMaxBundleMessages();

        if (pendingBundleIdForChainId[route.chainId] == 0) {
            pendingBundleIdForChainId[route.chainId] = initialBundleId(route.chainId);
        }
        _commitPendingBundle(route.chainId);
        routeMessageFee[route.chainId] = route.messageFee;
        routeMaxBundleMessages[route.chainId] = route.maxBundleMessages;
    }

    /* Getters */
    function initialBundleId(uint256 toChainId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_domainSeparatorV4(), toChainId));
    }

    /* Internal */
    function _sendFeesToHub(uint256 amount) internal virtual {
        emit FeesSentToHub(amount);

        (bool success, ) = hubFeeDistributor.call{value: amount}("");
        if (!success) revert(); // TransferFailed(to, amount);
    }
}
