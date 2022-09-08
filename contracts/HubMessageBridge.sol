//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";

interface ISpokeMessageBridge {
    function receiveMessageBundle(bytes32 bundleRoot, uint256 bundleValue, uint256 fromChainId) external payable;
    function forwardMessage(address to, address from, bytes calldata message) external payable;
}

contract HubMessageBridge is MessageBridge {
    address ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;

    mapping(uint256 => ISpokeMessageBridge) private spokeBridgeForChainId;
    mapping(address => uint256) private chainIdForSpokeBridge;
    mapping(uint256 => uint256) private exitTimeForChainId;
    uint256 relayWindow;

    /// @dev  Wrapper for sending Hub -> Spoke messages
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
        ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);

        spokeBridge.forwardMessage{value: value}(to, msg.sender, message);
    }

    function receiveOrForwardMessageBundle(
        uint256 toChainId,
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 commitTime
    )
        external
        payable
    {
        // Nonreentrant

        uint256 fromChainId = getChainId(msg.sender);
        if (toChainId == getChainId()) {
            bytes32 bundleId = keccak256(abi.encodePacked(fromChainId, toChainId, bundleRoot, bundleValue));
            bundles[bundleId] = ConfirmedBundle(fromChainId, bundleRoot, bundleValue);
        } else {
            ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);
            spokeBridge.receiveMessageBundle(bundleRoot, bundleValue, fromChainId);
        }

        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
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
        (bool success, ) = to.call{value: amount}("");
        require(success, "BRG: Transfer failed");
    }

    // Getters

    function getSpokeBridge(uint256 chainId) public view returns (ISpokeMessageBridge) {
        ISpokeMessageBridge bridge = spokeBridgeForChainId[chainId];
        require(address(bridge) != ZERO_ADDRESS, "BRG: No bridge for chainId");
        return bridge;
    }

    function getChainId(address bridge) public view returns (uint256) {
        uint256 chainId = chainIdForSpokeBridge[bridge];
        require(chainId != 0, "BRG: Invalid caller");
        return chainId;
    }

    function getSpokeExitTime(uint256 chainId) public view returns (uint256) {
        uint256 exitTime = exitTimeForChainId[chainId];
        require(exitTime > 0, "BRG: No exit time for chainId");
        return exitTime;
    }
}
