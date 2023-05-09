// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBundleVerifier {
    function isBundleVerified(uint256 fromChainId, bytes32 bundleId, bytes32 bundleRoot) external returns (bool);
}

interface IHopMessageReceiver {
    function hopBundleVerifier() external view returns (address);
    function hopMessageVerifier() external view returns (address);
}

contract VerificationManager is Ownable {
    struct BundleInfo {
        bytes32 root;
        uint256 timestamp;
    }

    // fromChainId -> bundleId -> BundleInfo
    mapping(uint256 => mapping(bytes32 => BundleInfo)) public bundleData;

    address public defaultBundleVerifier;
    // messageReceiver -> bundleVerifier
    mapping(address => address) public registedBundleVerifiers;
    // bundleVerifier -> fromChainId -> bundleId -> verified status
    mapping(address => mapping(uint256 => mapping(bytes32 => bool))) public verifiedBundleIds;

    event BundlePosted(uint256 fromChainId, bytes32 bundleId, bytes32 root, uint256 timestamp);
    event BundleProven(uint256 fromChainId, bytes32 bundleId, bool result);
    event VerifierRegistered(address indexed receiver, address indexed bundleVerifier);

    function postBundle(uint256 fromChainId, bytes32 bundleId, bytes32 bundleRoot) external {
        bundleData[fromChainId][bundleId] = BundleInfo({
            root: bundleRoot,
            timestamp: block.timestamp
        });

        emit BundlePosted(fromChainId, bundleId, bundleRoot, block.timestamp);
    }

    function proveBundle(address bundleVerifier, uint256 fromChainId, bytes32 bundleId) external returns (bool) {
        BundleInfo memory bundleInfo = bundleData[fromChainId][bundleId];

        require(bundleInfo.timestamp != 0, "VerificationManager: Bundle not found");

        IBundleVerifier verifier = IBundleVerifier(bundleVerifier);
        bool verified = verifier.isBundleVerified(fromChainId, bundleId, bundleInfo.root);

        verifiedBundleIds[defaultBundleVerifier][fromChainId][bundleId] = verified;
        emit BundleProven(fromChainId, bundleId, verified);

        return verified;
    }

    // ToDo: Enable message specific verification
    function isMessageVerified(uint256 fromChainId, bytes32 bundleId, bytes32 /* messageId */, address messageReceiver) external view returns (bool) {
        address bundleVerifier = registedBundleVerifiers[messageReceiver];
        if (bundleVerifier == address(0)) {
            bundleVerifier = defaultBundleVerifier;
        }

        return verifiedBundleIds[bundleVerifier][fromChainId][bundleId];
    }

    function setDefaultBundleVerifier(address verifier) external onlyOwner {
        defaultBundleVerifier = verifier;
    }

    function registerMessageReceiver(address receiver) external {
        IHopMessageReceiver messageReceiver = IHopMessageReceiver(receiver);
        address bundleVerifier = messageReceiver.hopBundleVerifier();

        registedBundleVerifiers[receiver] = bundleVerifier;

        emit VerifierRegistered(receiver, bundleVerifier);
    }
}