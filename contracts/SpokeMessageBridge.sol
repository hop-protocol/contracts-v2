//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "./utils/Lib_MerkleTree.sol";

struct PendingBundle {
    bytes32[] messageIds;
    uint256 value;
    uint256 fees;
}

struct Route {
    uint256 chainId;
    uint256 messageFee;
    uint256 maxBundleMessages;
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
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

contract SpokeMessageBridge is MessageBridge {
    using Lib_PendingBundle for PendingBundle;
    using MessageLibrary for Message;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    IHubMessageBridge public hubBridge;
    mapping(uint256 => uint256) routeMessageFee;
    mapping(uint256 => uint256) routeMaxBundleMessages;

    mapping(uint256 => PendingBundle) public pendingBundleForChainId;

    // Message nonce
    uint256 public messageNonce = uint256(keccak256(abi.encodePacked(getChainId(), "SpokeMessageBridge v1.0")));

    constructor(IHubMessageBridge _hubBridge, Route[] memory routes) {
        hubBridge = _hubBridge;
        for (uint256 i = 0; i < routes.length; i++) {
            // ToDo: require chainId is not 0
            // ToDo: require messageFee is not 0
            // ToDo: require maxBundleMessages is not 0
            Route memory route = routes[i];
            routeMessageFee[route.chainId] = route.messageFee;
            routeMaxBundleMessages[route.chainId] = route.maxBundleMessages;
        }
    }

    function sendMessage(
        uint256 toChainId,
        address to,
        uint256 value,
        bytes calldata data
    )
        external
        override
        payable
    {
        uint256 messageFee = routeMessageFee[toChainId];
        uint256 requiredValue = messageFee + value;
        if (requiredValue != msg.value) {
            revert IncorrectValue(requiredValue, msg.value);
        }
        uint256 fromChainId = getChainId();

        Message memory message = Message(
            messageNonce,
            fromChainId,
            msg.sender,
            to,
            value,
            data
        );
        messageNonce++;

        bytes32 messageId = message.getMessageId();
        PendingBundle storage pendingBundle = pendingBundleForChainId[toChainId];
        pendingBundle.messageIds.push(messageId);
        // combine these for 1 sstore
        pendingBundle.value = pendingBundle.value + msg.value;
        pendingBundle.fees = pendingBundle.fees + messageFee;

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
        bytes32 bundleRoot = pendingBundle.getBundleRoot();
        uint256 bundleValue = pendingBundle.value;
        uint256 pendingFees = pendingBundle.fees;
        delete pendingBundleForChainId[toChainId];

        hubBridge.receiveOrForwardMessageBundle{value: bundleValue}(
            bundleRoot,
            bundleValue,
            pendingFees,
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
