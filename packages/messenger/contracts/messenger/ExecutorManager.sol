// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@hop-protocol/shared-solidity/contracts/OverridableChainId.sol";
import "./ExecutorHead.sol";
import "../interfaces/ITransportLayer.sol";
import "../libraries/Error.sol";
import "../libraries/Bitmap.sol";
import "../libraries/MerkleTreeLib.sol";
import "../libraries/MessengerLib.sol";
import "hardhat/console.sol";

interface IHopMessageReceiver {
    // Optional functions for custom validation logic
    function hop_transporter() external view returns (address);
    function hop_messageVerifier() external view returns (address);
}

struct BundleProof {
    bytes32 bundleNonce;
    uint256 treeIndex;
    bytes32[] siblings;
    uint256 totalLeaves;
}

contract ExecutorManager is Ownable, OverridableChainId {
    using BitmapLibrary for Bitmap;

    address immutable public head;

    address public defaultTransporter;
    // messageReceiver -> transporter
    mapping(address => address) public registedTransporters;
    // transporter -> fromChainId -> bundleId -> verified status
    mapping(address => mapping(uint256 => mapping(bytes32 => bool))) public verifiedBundleIdes;
    address public verificationManager;
    mapping(bytes32 => Bitmap) private spentMessagesForBundleNonce;

    event BundleProven(
        uint256 indexed fromChainId,
        bytes32 indexed bundleNonce,
        bytes32 bundleRoot,
        bytes32 bundleId
    );
    event VerifierRegistered(address indexed receiver, address indexed transporter);

    constructor(address _defaultTransporter) {
        defaultTransporter = _defaultTransporter;

        head = address(new ExecutorHead());
    }

    function executeMessage(
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        BundleProof memory bundleProof
    ) external {
        bytes32 messageId = MessengerLib.getMessageId(
            bundleProof.bundleNonce,
            bundleProof.treeIndex,
            fromChainId,
            from,
            getChainId(),
            to,
            data
        );
        bytes32 bundleRoot = MerkleTreeLib.processProof(
            messageId,
            bundleProof.treeIndex,
            bundleProof.siblings,
            bundleProof.totalLeaves
        );

        bool _isBundleVerified = isBundleVerified(
            fromChainId,
            bundleProof.bundleNonce,
            bundleRoot,
            to
        );
        if (!_isBundleVerified) {
            revert InvalidBundle(verificationManager, fromChainId, bundleProof.bundleNonce, to);
        }

        Bitmap storage spentMessages = spentMessagesForBundleNonce[bundleProof.bundleNonce];
        spentMessages.switchTrue(bundleProof.treeIndex); // Reverts if already true

        // ToDo: Log BunldeId? treeIndex?
        ExecutorHead(head).executeMessage(messageId, fromChainId, from, to, data);
    }

    function isMessageSpent(bytes32 bundleNonce, uint256 index) public view returns (bool) {
        Bitmap storage spentMessages = spentMessagesForBundleNonce[bundleNonce];
        return spentMessages.isTrue(index);
    }

    function proveBundle(address transportLayer, uint256 fromChainId, bytes32 bundleNonce, bytes32 bundleRoot) external {
        bytes32 bundleId = MessengerLib.getBundleId(fromChainId, getChainId(), bundleNonce, bundleRoot);
        bool verified = ITransportLayer(transportLayer).isCommitmentProven(fromChainId, bundleId);
        if (!verified) revert ProveBundleFailed(transportLayer, fromChainId, bundleNonce);

        verifiedBundleIdes[defaultTransporter][fromChainId][bundleId] = true;
        emit BundleProven(fromChainId, bundleNonce, bundleRoot, bundleId);
    }

    // ToDo: Enable message specific verification
    function isBundleVerified(
        uint256 fromChainId,
        bytes32 bundleNonce,
        bytes32 bundleRoot,
        address messageReceiver
    )
        public
        view
        returns (bool)
    {
        // check if bundle has been proven
        address transporter = registedTransporters[messageReceiver];
        if (transporter == address(0)) {
            transporter = defaultTransporter;
        }

        bytes32 bundleId = MessengerLib.getBundleId(fromChainId, getChainId(), bundleNonce, bundleRoot);
        return verifiedBundleIdes[transporter][fromChainId][bundleId];
    }

    function setDefaultTransporter(address verifier) external onlyOwner {
        defaultTransporter = verifier;
    }

    function registerMessageReceiver(address receiver) external {
        IHopMessageReceiver messageReceiver = IHopMessageReceiver(receiver);
        address transporter = messageReceiver.hop_transporter();

        registedTransporters[receiver] = transporter;

        emit VerifierRegistered(receiver, transporter);
    }
}