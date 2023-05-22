// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../transporter/ITransportLayer.sol";
import "../libraries/Error.sol";
import "../utils/Lib_MerkleTree.sol";
import "hardhat/console.sol";

interface IHopMessageReceiver {
    // Optional functions for custom validation logic
    function hop_transporter() external view returns (address);
    function hop_messageVerifier() external view returns (address);
}

contract VerificationManager is Ownable {
    address public defaultTransporter;
    // messageReceiver -> transporter
    mapping(address => address) public registedTransporters;
    // transporter -> fromChainId -> bundleHash -> verified status
    mapping(address => mapping(uint256 => mapping(bytes32 => bool))) public verifiedBundleHashes;

    event BundleProven(
        uint256 indexed fromChainId,
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        bytes32 bundleHash
    );
    event VerifierRegistered(address indexed receiver, address indexed transporter);

    constructor(address _defaultTransporter) {
        defaultTransporter = _defaultTransporter;
    }

    function proveBundle(address transportLayer, uint256 fromChainId, bytes32 bundleId, bytes32 bundleRoot) external {
        bytes32 bundleHash = getBundleHash(fromChainId, getChainId(), bundleId, bundleRoot);
        bool verified = ITransportLayer(transportLayer).isCommitmentProven(fromChainId, bundleHash);
        if (!verified) revert ProveBundleFailed(transportLayer, fromChainId, bundleId);

        verifiedBundleHashes[defaultTransporter][fromChainId][bundleHash] = true;
        emit BundleProven(fromChainId, bundleId, bundleRoot, bundleHash);
    }

    // ToDo: Enable message specific verification
    function isMessageVerified(
        uint256 fromChainId,
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 /*treeIndex*/,
        bytes32 /*messageId*/,
        address messageReceiver
    )
        external
        view
        returns (bool)
    {
        // check if bundle has been proven
        address transporter = registedTransporters[messageReceiver];
        if (transporter == address(0)) {
            transporter = defaultTransporter;
        }

        bytes32 bundleHash = getBundleHash(fromChainId, getChainId(), bundleId, bundleRoot);
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

    // ToDo: deduplicate
    function getBundleHash(uint256 fromChainId, uint256 toChainId, bytes32 bundleId, bytes32 bundleRoot) public pure returns (bytes32) {
        return keccak256(abi.encode(fromChainId, toChainId, bundleId, bundleRoot));
    }

    // Deduplicate
    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}