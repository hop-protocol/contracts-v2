//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";

// attach the bundle fee and bundle relayer to the root and reward them when it is set.

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 toChainId,
        address bundleRelayerAddress
    ) external payable;
}

struct Message {
    address to;
    bytes message;
    uint256 value;
}

struct Bundle {
    bytes32 bundleRoot;
    uint256 bundleValue;
}

contract HopMessageBridge {
    using Lib_MerkleTree for bytes32;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    mapping(uint256 => IHopMessageReceiver) bridgeForChainId;
    // destination chain Id -> pending message Ids
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingValue;
    mapping(uint256 => uint256) public pendingBundleFees;
    mapping(bytes32 => Bundle) bundles;
    mapping(bytes32 => bool) relayedMessage;
    mapping(uint256 => uint256) routeMessageFee; // ToDo: Add setter
    mapping(uint256 => uint256) routeMaxBundleMessages;

    function sendMessage(uint256 toChainId, address to, bytes calldata message, uint256 value) external payable {
        // Require msg.value > bundleFee
        // Require bundleFee > minBundleFee
        uint256 routeFee = routeMessageFee[toChainId];
        uint256 rquiredValue = routeFee + value;
        require(rquiredValue == msg.value, "MSG_BRG: Incorrect msg.value");

        bytes32 messageId = getMessageId(msg.sender, to, msg.value, message);
        bytes32 storage pendingMessageIds = pendingMessageIdsForChainId[toChainId];
        pendingMessageIds.push(messageId);

        pendingValue[toChainId] = pendingValue[toChainId] + msg.value;
        pendingBundleFees[toChainId] = pendingBundleFees[toChainId] + bundleFee;

        uint256 maxBundleMessages = routeMaxBundleMessages[toChainId];

        if (pendingMessageIds.length >= routeMaxBundleMessages) {
            _commitMessageBundle(toChainId);
        }
    }

    function _commitMessageBundle(uint256 toChainId) private {
        bytes32[] storage pendingMessages = pendingMessageIdsForChainId[toChainId];
        bytes32 bundleRoot = Lib_MerkleTree.getMerkleRoot(pendingMessages);
        uint256 bundleValue = pendingValue[toChainId];
        uint256 pendingFees = pendingBundleFees[toChainId];

        IHopMessageReceiver bridge = bridgeForChainId[toChainId];
        bridge.receiveMessageBundle{value: bundleValue}(
            bundleRoot,
            bundleValue,
            pendingFees,
            getChainId(),
            toChainId,
            now
        );
    }

    // L1 only
    mapping(uint256 => uint256) exitTime;
    uint256 relayWindow;
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        address bundleRelayerAddress,
        uint256 commitTime
    )
        external
        payable
    {
        require(now >= relayWindowStart, "MSG_BRG: Relay window not started");

        // distribute bundle reward if msg.sender == bundleRelayerAddress || block.timestamp > (commitTime + protectedRelayTime)
        if (toChainId == getChainId()) {
            bytes32 bundleId = keccak256(abi.encodePacked(bundleRoot, bundleValue, toChainId));
            bundles[bundleId] = Bundle(bundleRoot, bundleValue);
        } else {
            // forward root to destination
        }

        uint256 relayWindowStart = commitTime + exitTime[fromChainId];
        uint256 relayWindowEnd = relayWindowStart + relayWindow;
        uint256 relayReward = 0;
        if (now > relayWindowEnd) {
            relayReward = bundleFees;
        } else if (now >= relayWindowStart) {
            relayReward = (now - relayWindowStart) * bundleFees / relayWindow;
        }
    }

    function relayMessage(
        address from,
        address to,
        uint256 value,
        bytes calldata message,
        bytes32 bundleId,
        uint256 treeIndex,
        bytes32[] calldata siblings,
        uint256 totalLeaves
    )
        external
    {
        Bundle memory bundle = bundles[bundleId];
        require(bundle.bundleRoot != bytes32(0), "MSG_BRG: Bundle not found");
        bytes32 messageId = getMessageId(from, to, value, message);
        require(
            bundle.bundleRoot.verify(
                messageId,
                treeIndex,
                siblings,
                totalLeaves
            ),
            "MSG_BRG: Invalid proof"
        );

        relayedMessage[messageId] = true;

        xDomainSender = from;
        (bool success, ) = to.call{value: value}(message);
        xDomainSender = DEFAULT_XDOMAIN_SENDER;

        if (success == false) {
            relayedMessage[messageId] = false;
        }
    }

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }

    function getMessageId(
        address from,
        address to,
        uint256 value,
        bytes memory message
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(from, to, value, message));
    }

    function getRouteId(uint256 toChainId) public pure returns (bytes32) {
        return keccak256(getChainId(), toChainId);
    }

    function xDomainMessageSender() public view returns (address) {
        require(
            xDomainSender != DEFAULT_XDOMAIN_SENDER,
            "MSG_BRG: xDomainMessageSender is not set"
        );
        return xDomainSender;
    }
}
