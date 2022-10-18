//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "./FeeDistributor/FeeDistributor.sol";
import "../interfaces/IHubMessageBridge.sol";
import "../interfaces/ISpokeMessageBridge.sol";

contract HubMessageBridge is MessageBridge, IHubMessageBridge {
    using MessageLibrary for Message;

    /* events */
    event BundleReceived(bytes32 indexed bundleId);
    event BundleForwarded(bytes32 indexed bundleId);

    /* config */
    mapping(address => uint256) private chainIdForSpokeBridge;
    mapping(uint256 => ISpokeMessageBridge) private spokeBridgeForChainId;
    mapping(uint256 => uint256) private exitTimeForChainId;
    mapping(uint256 => FeeDistributor) private feeDistributorForChainId;
    uint256 public relayWindow = 12 hours;

    /// @dev  Wrapper for sending Hub -> Spoke messages
    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        external
        payable
    {
        ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);

        bytes32 messageId = bytes32(0); // ToDo: L1 -> L2 messageId
        uint256 nonce = 0; // ToDo: L1 -> L2 nonce

        // ToDo: What is the gas implication of this?
        // Message memory message = Message(
        //     nonce,
        //     getChainId(),
        //     msg.sender,
        //     toChainId,
        //     to,
        //     data
        // );
        // bytes32 messageId = message.getMessageId();

        emit MessageSent(
            messageId,
            nonce,
            msg.sender,
            toChainId,
            to,
            data
        );

        spokeBridge.forwardMessage(msg.sender, to, data);
    }

    function receiveOrForwardMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 toChainId,
        uint256 commitTime
    )
        external
    {
        // ToDo: Nonreentrant
        // ToDo: Require that msg.value == bundleValue + bundleFees
        // ToDo: Only Spoke
        uint256 fromChainId = getSpokeChainId(msg.sender);
        bytes32 bundleId = getBundleId(fromChainId, toChainId, bundleRoot);

        if (toChainId == getChainId()) {
            bundles[bundleId] = ConfirmedBundle(fromChainId, bundleRoot);
            emit BundleReceived(bundleId);
        } else {
            ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);
            spokeBridge.receiveMessageBundle(bundleRoot, fromChainId);
            emit BundleForwarded(bundleId);
        }

        // Pay relayer
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        uint256 relayWindowEnd = relayWindowStart + relayWindow;
        uint256 relayReward = 0;
        if (block.timestamp > relayWindowEnd) {
            relayReward = bundleFees;
        } else if (block.timestamp >= relayWindowStart) {
            relayReward = (block.timestamp - relayWindowStart) * bundleFees / relayWindow;
        }

        if (relayReward > 0) {
            FeeDistributor feeDistributor = getFeeDistributor(fromChainId);
            feeDistributor.payFee(tx.origin, relayReward, bundleFees);
        }
    }

    // Setters
    function setSpokeBridge(
        uint256 chainId,
        address spokeBridge,
        uint256 exitTime,
        address payable feeDistributor
    )
        external
        onlyOwner
    {
        if (chainId == 0) revert NoZeroChainId();

        chainIdForSpokeBridge[spokeBridge] = chainId;
        spokeBridgeForChainId[chainId] = ISpokeMessageBridge(spokeBridge);
        exitTimeForChainId[chainId] = exitTime;
        feeDistributorForChainId[chainId] = FeeDistributor(feeDistributor);
    }

    function setRelayWindow(uint256 _relayWindow) external onlyOwner {
        if (_relayWindow == 0) revert NoZeroRelayWindow();
        relayWindow = _relayWindow;
    }

    // Getters
    function getSpokeBridge(uint256 chainId) public view returns (ISpokeMessageBridge) {
        ISpokeMessageBridge bridge = spokeBridgeForChainId[chainId];
        if (address(bridge) == address(0)) {
            revert NoBridge(chainId);
        }
        return bridge;
    }

    function getSpokeChainId(address bridge) public view returns (uint256) {
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

    function getFeeDistributor(uint256 chainId) public view returns (FeeDistributor) {
        FeeDistributor feeDistributor = feeDistributorForChainId[chainId];
        if (address(feeDistributor) == address(0)) {
            revert InvalidChainId(chainId);
        }
        return feeDistributor;
    }
}
