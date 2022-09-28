//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "./FeeDistributor/FeeDistributor.sol";

interface ISpokeMessageBridge {
    function receiveMessageBundle(bytes32 bundleRoot, uint256 fromChainId) external payable;
    function forwardMessage(address from, address to, bytes calldata data) external;
}

contract HubMessageBridge is MessageBridge {
    /* events */
    event MessageSent(address indexed from, uint256 indexed toChainId, address indexed to, bytes32 dataHash);
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
        override
        payable
    {
        ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);

        emit MessageSent(msg.sender, toChainId, to, keccak256(data));

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
        uint256 fromChainId = getChainId(msg.sender);
        bytes32 bundleId = keccak256(abi.encodePacked(fromChainId, toChainId, bundleRoot));
        if (toChainId == getChainId()) {
            bundles[bundleId] = ConfirmedBundle(fromChainId, bundleRoot);
            emit BundleReceived(bundleId);
        } else {
            ISpokeMessageBridge spokeBridge = getSpokeBridge(fromChainId);
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

    function getFeeDistributor(uint256 chainId) public view returns (FeeDistributor) {
        FeeDistributor feeDistributor = feeDistributorForChainId[chainId];
        if (address(feeDistributor) == address(0)) {
            revert InvalidChainId(chainId);
        }
        return feeDistributor;
    }
}
