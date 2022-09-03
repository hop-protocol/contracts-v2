//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";

interface ISpokeMessageBridge {
    function receiveMessageBundle(bytes32 bundleRoot, uint256 bundleValue, uint256 fromChainId) external payable;
    function forwardMessage(address to, address from, bytes calldata message) external payable;
}

contract HubMessageBridge is MessageBridge {
    mapping(uint256 => ISpokeMessageBridge) bridgeForChainId;
    mapping(uint256 => uint256) exitTimeForChainId;
    uint256 relayWindow;

    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata message,
        uint256 value
    )
        external
        payable
    {
        require(value == msg.value, "MSG_BRG: Incorrect msg.value");

        ISpokeMessageBridge spokeBridge = bridgeForChainId[toChainId];
        spokeBridge.forwardMessage{value: value}(to, msg.sender, message);
    }

    function receiveOrForwardMessageBundle(
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
        // Nonreentrant
        // distribute bundle reward if msg.sender == bundleRelayerAddress || block.timestamp > (commitTime + protectedRelayTime)

        if (toChainId == getChainId()) {
            bytes32 bundleId = keccak256(abi.encodePacked(bundleRoot, bundleValue, toChainId));
            bundles[bundleId] = ConfirmedBundle(bundleRoot, bundleValue, fromChainId);
        } else {
            ISpokeMessageBridge spokeBridge = bridgeForChainId[toChainId];
            spokeBridge.receiveMessageBundle(bundleRoot, bundleValue, fromChainId);
        }

        uint256 relayWindowStart = commitTime + exitTimeForChainId[fromChainId];
        uint256 relayWindowEnd = relayWindowStart + relayWindow;
        uint256 relayReward = 0;
        if (block.timestamp > relayWindowEnd) {
            relayReward = bundleFees;
        } else if (block.timestamp >= relayWindowStart) {
            relayReward = (block.timestamp - relayWindowStart) * bundleFees / relayWindow;
        }

        if (relayReward > 0) {
            transfer(tx.origin, relayReward);
        }
    }

    function transfer(address to, uint256 amount) private {
        (bool success, ) = tx.origin.call{value: amount}("");
        require(success, "BRG: Transfer failed");
    }
}
