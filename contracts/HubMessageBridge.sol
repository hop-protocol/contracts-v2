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
        override
        payable
    {
        if (value != msg.value) {
            revert IncorrectValue(value, msg.value);
        }
        ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);

        spokeBridge.forwardMessage{value: value}(to, msg.sender, message);
    }

    function receiveOrForwardMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 toChainId,
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
            ISpokeMessageBridge spokeBridge = getSpokeBridge(fromChainId);
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
        if (!success) revert TransferFailed(to, amount);
    }

    // Setters

    function setSpokeBridge(uint256 chainId, address spokeBridge, uint256 exitTime) external {
        // ToDo: Only owner
        // ToDo: require chainId is not 0
        chainIdForSpokeBridge[spokeBridge] = chainId;
        spokeBridgeForChainId[chainId] = ISpokeMessageBridge(spokeBridge);
        exitTimeForChainId[chainId] = exitTime;
    }

    // Getters

    function getSpokeBridge(uint256 chainId) public view returns (ISpokeMessageBridge) {
        ISpokeMessageBridge bridge = spokeBridgeForChainId[chainId];
        if (address(bridge) == ZERO_ADDRESS) {
            revert NoBridge(chainId);
        }
        return bridge;
    }

    function getChainId(address bridge) public view returns (uint256) {
        uint256 chainId = chainIdForSpokeBridge[bridge];
        if (chainId == 0) {
            revert InvalidBridgeCaller(bridge);
        }
        return chainId;
    }

    function getSpokeExitTime(uint256 chainId) public view returns (uint256) {
        uint256 exitTime = exitTimeForChainId[chainId];
        if (exitTime == 0) {
            revert InvalidChainId(chainId);
        }
        return exitTime;
    }
}
