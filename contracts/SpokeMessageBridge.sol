//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "./utils/Lib_MerkleTree.sol";

struct PendingBundle {
    bytes32[] messageIds;
    uint256 value;
    uint256 fees;
}

library Lib_PendingBundle {
    using Lib_MerkleTree for bytes32;

    function getBundleRoot(PendingBundle storage pendingBundle) internal view returns (bytes32) {
        return Lib_MerkleTree.getMerkleRoot(pendingBundle.messageIds);
    }
}

interface IHubMessageBridge {
    function receiveOrForwardMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

contract SpokeMessageBridge is MessageBridge {
    using Lib_PendingBundle for PendingBundle;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    IHubMessageBridge public hubBridge;
    mapping(uint256 => PendingBundle) public pendingBundleForChainId;
    mapping(uint256 => uint256) routeMessageFee;
    mapping(uint256 => uint256) routeMaxBundleMessages;

    function sendMessage(uint256 toChainId, address to, bytes calldata message, uint256 value) external payable {
        uint256 messageFee = routeMessageFee[toChainId];
        uint256 requiredValue = messageFee + value;
        if (requiredValue != msg.value) {
            revert IncorrectValue(requiredValue, msg.value);
        }

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
        bytes32 bundleRoot = pendingBundle.getBundleRoot();
        uint256 bundleValue = pendingBundle.value;
        uint256 pendingFees = pendingBundle.fees;
        delete pendingBundleForChainId[toChainId];

        hubBridge.receiveOrForwardMessageBundle{value: bundleValue}(
            bundleRoot,
            bundleValue,
            pendingFees,
            getChainId(),
            toChainId,
            block.timestamp
        );
    }

    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 fromChainId
    )
        external
        payable
    {
        bytes32 bundleId = keccak256(abi.encodePacked(bundleRoot, bundleValue, getChainId()));
        bundles[bundleId] = ConfirmedBundle(fromChainId, bundleRoot, bundleValue);
    }
}
