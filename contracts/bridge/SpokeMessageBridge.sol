//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "../utils/Lib_MerkleTree.sol";
import "../interfaces/ICrossChainSource.sol";
import "../interfaces/IHubMessageBridge.sol";
import "../interfaces/ISpokeMessageBridge.sol";

struct PendingBundle {
    bytes32[] messageIds;
    uint256 fees;
}

struct Route {
    uint256 chainId;
    uint256 messageFee;
    uint256 maxBundleMessages;
}

contract SpokeMessageBridge is MessageBridge, ISpokeMessageBridge {
    using Lib_MerkleTree for bytes32;
    using MessageLibrary for Message;

    /* events */
    event FeesSentToHub(uint256 amount);
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
    uint256 public pendingFeeBatchSize; // ToDo: Add manual flush or change name to pendingFeeBatchSize
    mapping(uint256 => uint256) public routeMessageFee;
    mapping(uint256 => uint256) public routeMaxBundleMessages;

    /* state */
    mapping(uint256 => PendingBundle) public pendingBundleForChainId;
    uint256 public totalPendingFees;
    uint256 public nonce = uint256(keccak256(abi.encodePacked(getChainId(), "SpokeMessageBridge v1.0")));

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
        uint256 messageFee = routeMessageFee[toChainId];
        if (messageFee != msg.value) {
            revert IncorrectFee(messageFee, msg.value);
        }
        uint256 fromChainId = getChainId();

        Message memory message = Message(
            nonce,
            fromChainId,
            msg.sender,
            toChainId,
            to,
            data
        );
        nonce++;

        bytes32 messageId = message.getMessageId();
        PendingBundle storage pendingBundle = pendingBundleForChainId[toChainId];
        pendingBundle.messageIds.push(messageId);
        pendingBundle.fees = pendingBundle.fees + messageFee;

        emit MessageSent(messageId, message.nonce, msg.sender, toChainId, to, data);

        uint256 maxBundleMessages = routeMaxBundleMessages[toChainId];
        if (pendingBundle.messageIds.length == maxBundleMessages) {
            _commitMessageBundle(toChainId);
        }
    }

    function commitMessageBundle(uint256 toChainId) external payable {
        uint256 totalFees = pendingBundleForChainId[toChainId].fees + msg.value;
        uint256 messageFee = routeMessageFee[toChainId];
        uint256 numMessages = routeMaxBundleMessages[toChainId];
        uint256 fullBundleFee = messageFee * numMessages;
        if (fullBundleFee > totalFees) {
            revert NotEnoughFees(fullBundleFee, totalFees);
        }
        _commitMessageBundle(toChainId);
    }

    function _commitMessageBundle(uint256 toChainId) private {
        PendingBundle storage pendingBundle = pendingBundleForChainId[toChainId];
        bytes32 bundleRoot = Lib_MerkleTree.getMerkleRoot(pendingBundle.messageIds);
        uint256 pendingFees = pendingBundle.fees;
        delete pendingBundleForChainId[toChainId];

        totalPendingFees += pendingFees;
        uint256 _totalPendingFees = totalPendingFees;
        if (_totalPendingFees >= pendingFeeBatchSize) {
            // Send fees to l1
            totalPendingFees = 0;
            _sendFeesToHub(_totalPendingFees);
        }

        hubBridge.receiveOrForwardMessageBundle(
            bundleRoot,
            pendingFees,
            toChainId,
            block.timestamp
        );

        bytes32 bundleId = getBundleId(getChainId(), toChainId, bundleRoot);
        emit BundleCommitted(bundleId, bundleRoot, pendingFees, toChainId, block.timestamp);
    }

    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 fromChainId
    )
        external
        payable
        onlyHub
    {
        bytes32 bundleId = getBundleId(fromChainId, getChainId(), bundleRoot);
        bundles[bundleId] = ConfirmedBundle(fromChainId, bundleRoot);
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

        routeMessageFee[route.chainId] = route.messageFee;
        routeMaxBundleMessages[route.chainId] = route.maxBundleMessages;
    }

    /* Internal */
    function _sendFeesToHub(uint256 amount) internal virtual {

        emit FeesSentToHub(amount);

        (bool success, ) = hubFeeDistributor.call{value: amount}("");
        if (!success) revert(); // TransferFailed(to, amount);
    }
}
