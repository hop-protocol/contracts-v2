//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";

// attach the bundle fee and bundle relayer to the root and reward them when it is set.

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

struct Message {
    address to;
    bytes message;
    uint256 value;
}

struct PendingBundle {
    bytes32[] messageIds;
    uint256 value;
    uint256 fees;
}

struct ConfirmedBundle {
    bytes32 bundleRoot;
    uint256 bundleValue;
}

library Lib_PendingBundle {
    using Lib_MerkleTree for bytes32;

    function getBundleRoot(PendingBundle storage pendingBundle) internal view returns (bytes32) {
        return Lib_MerkleTree.getMerkleRoot(pendingBundle.messageIds);
    }
}

contract MessageBridge {
    using Lib_MerkleTree for bytes32;
    using Lib_PendingBundle for PendingBundle;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    mapping(uint256 => IHopMessageReceiver) bridgeForChainId;
    // destination chain Id -> pending message Ids
    mapping(uint256 => PendingBundle) public pendingBundleForChainId;
    mapping(bytes32 => ConfirmedBundle) bundles;
    mapping(bytes32 => bool) relayedMessage;
    mapping(uint256 => uint256) routeMessageFee; // ToDo: Add setter
    mapping(uint256 => uint256) routeMaxBundleMessages;

    function sendMessage(uint256 toChainId, address to, bytes calldata message, uint256 value) external payable {
        uint256 messageFee = routeMessageFee[toChainId];
        uint256 requiredValue = messageFee + value;
        require(requiredValue == msg.value, "MSG_BRG: Incorrect msg.value");

        PendingBundle storage pendingBundle = pendingBundleForChainId[toChainId];

        bytes32 messageId = getMessageId(msg.sender, to, msg.value, message);
        pendingBundle.messageIds.push(messageId);
        // combine these for 1 sstore
        pendingBundle.value = pendingBundle.value + msg.value;
        pendingBundle.fees = pendingBundle.fees + messageFee;

        uint256 maxBundleMessages = routeMaxBundleMessages[toChainId];
        if (pendingBundle.messageIds.length >= maxBundleMessages) {
            _commitMessageBundle(toChainId);
        }
    }

    function _commitMessageBundle(uint256 toChainId) private {
        // bytes32[] storage pendingMessages = pendingMessageIdsForChainId[toChainId];
        PendingBundle storage pendingBundle = pendingBundleForChainId[toChainId];
        bytes32 bundleRoot = pendingBundle.getBundleRoot();
        uint256 bundleValue = pendingBundle.value;
        uint256 pendingFees = pendingBundle.fees;
        delete pendingBundleForChainId[toChainId];

        IHopMessageReceiver bridge = bridgeForChainId[toChainId];
        bridge.receiveMessageBundle{value: bundleValue}(
            bundleRoot,
            bundleValue,
            pendingFees,
            getChainId(),
            toChainId,
            block.timestamp
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
        uint256 commitTime
    )
        external
        payable
    {
        // distribute bundle reward if msg.sender == bundleRelayerAddress || block.timestamp > (commitTime + protectedRelayTime)
        if (toChainId == getChainId()) {
            bytes32 bundleId = keccak256(abi.encodePacked(bundleRoot, bundleValue, toChainId));
            bundles[bundleId] = ConfirmedBundle(bundleRoot, bundleValue);
        } else {
            // forward root to destination
        }

        uint256 relayWindowStart = commitTime + exitTime[fromChainId];
        uint256 relayWindowEnd = relayWindowStart + relayWindow;
        uint256 relayReward = 0;
        if (block.timestamp > relayWindowEnd) {
            relayReward = bundleFees;
        } else if (block.timestamp >= relayWindowStart) {
            relayReward = (block.timestamp - relayWindowStart) * bundleFees / relayWindow;
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
        ConfirmedBundle memory bundle = bundles[bundleId];
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

    function xDomainMessageSender() public view returns (address) {
        require(
            xDomainSender != DEFAULT_XDOMAIN_SENDER,
            "MSG_BRG: xDomainMessageSender is not set"
        );
        return xDomainSender;
    }
}
