//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./MessageBridge.sol";
import "./FeeDistributor/FeeDistributor.sol";
import "../interfaces/IHubMessageBridge.sol";
import "../interfaces/ISpokeMessageBridge.sol";

contract HubMessageBridge is MessageBridge, IHubMessageBridge {
    /* events */
    event BundleReceived(
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 relayWindowStart,
        address indexed relayer
    );
    event BundleForwarded(
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        uint256 indexed fromChainId,
        uint256 indexed toChainId
    );

    /* config */
    uint256 public messageNonce;
    mapping(address => uint256) private chainIdForSpokeBridge;
    mapping(uint256 => ISpokeMessageBridge) private spokeBridgeForChainId;
    mapping(uint256 => uint256) private exitTimeForChainId;
    mapping(uint256 => FeeDistributor) private feeDistributorForChainId;

    /// @dev  Wrapper for sending Hub -> Spoke messages
    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        external
        payable
        returns (bytes32)
    {
        ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);

        bytes32 messageId = getHubMessageId(messageNonce);
        messageNonce++;

        emit MessageSent(
            messageId,
            msg.sender,
            toChainId,
            to,
            data
        );

        spokeBridge.forwardMessage(messageId, msg.sender, to, data);

        return messageId;
    }

    function getHubMessageId(uint256 nonce) public view returns (bytes32) {
        return keccak256(abi.encode(_domainSeparatorV4(), nonce));
    }

    function receiveOrForwardMessageBundle(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 toChainId,
        uint256 commitTime
    )
        external
    {
        uint256 fromChainId = getSpokeChainId(msg.sender);

        if (toChainId == getChainId()) {
            _setBundle(bundleId, bundleRoot, fromChainId);
        } else {
            ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);
            emit BundleForwarded(bundleId, bundleRoot, fromChainId, toChainId);
            spokeBridge.receiveMessageBundle(bundleId, bundleRoot, fromChainId);
        }

        // Pay relayer
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        emit BundleReceived(
            bundleId,
            bundleRoot,
            bundleFees,
            fromChainId,
            toChainId,
            relayWindowStart,
            tx.origin
        );
        FeeDistributor feeDistributor = getFeeDistributor(fromChainId);
        feeDistributor.payFee(tx.origin, relayWindowStart, bundleFees);
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
        if (spokeBridge == address(0)) revert NoZeroAddress(); 
        if (exitTime == 0) revert NoZeroExitTime();
        if (feeDistributor == address(0)) revert NoZeroAddress(); 

        noMessageList[spokeBridge] = true;
        chainIdForSpokeBridge[spokeBridge] = chainId;
        spokeBridgeForChainId[chainId] = ISpokeMessageBridge(spokeBridge);
        exitTimeForChainId[chainId] = exitTime;
        feeDistributorForChainId[chainId] = FeeDistributor(feeDistributor);
    }

    // Getters
    function getSpokeBridge(uint256 chainId) public view returns (ISpokeMessageBridge) {
        ISpokeMessageBridge bridge = spokeBridgeForChainId[chainId];
        if (address(bridge) == address(0)) {
            revert InvalidRoute(chainId);
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

    function getRelayReward(
        uint256 fromChainId,
        uint256 bundleFees,
        uint256 commitTime
    )
        public
        view
        returns (uint256)
    {
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        FeeDistributor feeDistributor = getFeeDistributor(fromChainId);
        return feeDistributor.getRelayReward(relayWindowStart, bundleFees);
    }
}
