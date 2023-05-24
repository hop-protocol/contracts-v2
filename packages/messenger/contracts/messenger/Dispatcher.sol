//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../libraries/Error.sol";
import "../libraries/MessengerLib.sol";
import "../libraries/MerkleTreeLib.sol";
import "../utils/OverridableChainId.sol";
import "../transporter/ITransportLayer.sol";

struct Route {
    uint256 chainId;
    uint128 messageFee;
    uint128 maxBundleMessages;
}

struct RouteData {
    uint128 messageFee;
    uint128 maxBundleMessages;
}

contract Dispatcher is Ownable, EIP712, OverridableChainId {
    using MerkleTreeLib for bytes32;

    /* events */
    event MessageSent(
        bytes32 indexed messageId,
        address indexed from,
        uint256 indexed toChainId,
        address to,
        bytes data
    );
    event MessageBundled(
        bytes32 indexed bundleId,
        uint256 indexed treeIndex,
        bytes32 indexed messageId
    );
    event BundleCommitted(
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 indexed toChainId,
        uint256 commitTime
    );

    /* config */
    address public transporter;
    mapping(uint256 => RouteData) public routeData;

    /* state */
    mapping(uint256 => bytes32) public pendingBundleIdForChainId;
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingFeesForChainId;

    constructor(
        address _transporter,
        Route[] memory routes
    )
        EIP712("Dispatcher", "1")
    {
        transporter = _transporter;
        for (uint256 i = 0; i < routes.length; i++) {
            Route memory route = routes[i];
            setRoute(route);
        }
    }

    function dispatchMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        external
        payable
        returns (bytes32)
    {
        RouteData memory _routeData = routeData[toChainId];
        if (_routeData.maxBundleMessages == 0) revert InvalidRoute(toChainId);
        if (_routeData.messageFee != msg.value) revert IncorrectFee(_routeData.messageFee, msg.value);

        uint256 fromChainId = getChainId();
        bytes32[] storage pendingMessageIds = pendingMessageIdsForChainId[toChainId];
        uint256 treeIndex = pendingMessageIds.length;

        bytes32 pendingBundleId = pendingBundleIdForChainId[toChainId];
        bytes32 messageId = MessengerLib.getMessageId(
            pendingBundleId,
            treeIndex,
            fromChainId,
            msg.sender,
            toChainId,
            to,
            data
        );

        pendingMessageIds.push(messageId);
        pendingFeesForChainId[toChainId] += msg.value;

        emit MessageSent(messageId, msg.sender, toChainId, to, data);
        emit MessageBundled(pendingBundleId, treeIndex, messageId);

        if (pendingMessageIds.length >= _routeData.maxBundleMessages) {
            _commitPendingBundle(toChainId);
        }

        return messageId;
    }

    function commitPendingBundle(uint256 toChainId) external payable {
        if (pendingMessageIdsForChainId[toChainId].length == 0) revert NoPendingBundle();

        pendingFeesForChainId[toChainId] += msg.value;
        
        RouteData memory _routeData = routeData[toChainId];
        uint256 numMessages = _routeData.maxBundleMessages;
        uint256 messageFee = _routeData.messageFee;

        uint256 fullBundleFee = messageFee * numMessages;
        if (fullBundleFee > pendingFeesForChainId[toChainId]) {
            revert NotEnoughFees(fullBundleFee, pendingFeesForChainId[toChainId]);
        }
        _commitPendingBundle(toChainId);
    }

    function _commitPendingBundle(uint256 toChainId) private {
        bytes32[] storage pendingMessageIds = pendingMessageIdsForChainId[toChainId];
        if (pendingMessageIds.length == 0) {
            return;
        }

        bytes32 bundleId = pendingBundleIdForChainId[toChainId];
        bytes32 bundleRoot = MerkleTreeLib.getMerkleRoot(pendingMessageIds);
        uint256 bundleFees = pendingFeesForChainId[toChainId];

        // New pending bundle
        pendingBundleIdForChainId[toChainId] = bytes32(uint256(pendingBundleIdForChainId[toChainId]) + 1);

        // Setting the array length to 0 while leaving storage slots dirty saves gas 15k gas per
        // message. and is safe inthis case because the array length is never set to a non-zero
        // number. This ensures dirty array slots can never be accessed until they're rewritten by
        // a `push()`.
        assembly {
            sstore(pendingMessageIds.slot, 0)
        }
        pendingFeesForChainId[toChainId] = 0;

        emit BundleCommitted(bundleId, bundleRoot, bundleFees, toChainId, block.timestamp);

        uint256 fromChainId = getChainId();
        bytes32 bundleHash = getBundleHash(fromChainId, toChainId, bundleId, bundleRoot);
        ITransportLayer(transporter).dispatchCommitment{value: bundleFees}(toChainId, bundleHash);
    }

    function setRoute(Route memory route) public onlyOwner {
        if (route.chainId == 0) revert NoZeroChainId();
        if (route.messageFee == 0) revert NoZeroMessageFee();
        if (route.maxBundleMessages == 0) revert NoZeroMaxBundleMessages();

        if (pendingBundleIdForChainId[route.chainId] == 0) {
            pendingBundleIdForChainId[route.chainId] = initialBundleId(route.chainId);
        }
        _commitPendingBundle(route.chainId);
        routeData[route.chainId] = RouteData(route.messageFee, route.maxBundleMessages);
    }

    /* Getters */
    function initialBundleId(uint256 toChainId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_domainSeparatorV4(), toChainId));
    }

    function getBundleHash(uint256 fromChainId, uint256 toChainId, bytes32 bundleId, bytes32 bundleRoot) public pure returns (bytes32) {
        return keccak256(abi.encode(fromChainId, toChainId, bundleId, bundleRoot));
    }

    function getFee(uint256 toChainId) external view returns (uint256) {
        return routeData[toChainId].messageFee;
    }
}
