// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ExecutorHead.sol";
import "../transporter/ITransportLayer.sol";
import "../libraries/Error.sol";
import "../libraries/Bitmap.sol";
import "../libraries/MerkleTreeLib.sol";
import "../libraries/MessengerLib.sol";
import "../utils/OverridableChainId.sol";
import "hardhat/console.sol";

interface IHopMessageReceiver {
    // Optional functions for custom validation logic
    function hop_transporter() external view returns (address);
    function hop_messageVerifier() external view returns (address);
}

struct BundleProof {
    bytes32 bundleId;
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
    // transporter -> fromChainId -> bundleHash -> verified status
    mapping(address => mapping(uint256 => mapping(bytes32 => bool))) public verifiedBundleHashes;
    address public verificationManager;
    mapping(bytes32 => Bitmap) private spentMessagesForBundleId;

    event BundleProven(
        uint256 indexed fromChainId,
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        bytes32 bundleHash
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
            bundleProof.bundleId,
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
            bundleProof.bundleId,
            bundleRoot,
            to
        );
        if (!_isBundleVerified) {
            revert InvalidBundle(verificationManager, fromChainId, bundleProof.bundleId, to);
        }

        Bitmap storage spentMessages = spentMessagesForBundleId[bundleProof.bundleId];
        spentMessages.switchTrue(bundleProof.treeIndex); // Reverts if already true

        // ToDo: Log BunldeId? treeIndex?
        ExecutorHead(head).executeMessage(messageId, fromChainId, from, to, data);
    }

    function isMessageSpent(bytes32 bundleId, uint256 index) public view returns (bool) {
        Bitmap storage spentMessages = spentMessagesForBundleId[bundleId];
        return spentMessages.isTrue(index);
    }

    function proveBundle(address transportLayer, uint256 fromChainId, bytes32 bundleId, bytes32 bundleRoot) external {
        bytes32 bundleHash = MessengerLib.getBundleHash(fromChainId, getChainId(), bundleId, bundleRoot);
        bool verified = ITransportLayer(transportLayer).isCommitmentProven(fromChainId, bundleHash);
        if (!verified) revert ProveBundleFailed(transportLayer, fromChainId, bundleId);

        verifiedBundleHashes[defaultTransporter][fromChainId][bundleHash] = true;
        emit BundleProven(fromChainId, bundleId, bundleRoot, bundleHash);
    }

    // ToDo: Enable message specific verification
    function isBundleVerified(
        uint256 fromChainId,
        bytes32 bundleId,
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

        bytes32 bundleHash = MessengerLib.getBundleHash(fromChainId, getChainId(), bundleId, bundleRoot);
        return verifiedBundleHashes[transporter][fromChainId][bundleHash];
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