//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

error NoZeroAddress();
error NoZeroChainId();
error NoZeroExitTime();
error NoZeroMessageFee();
error NoZeroMaxBundleMessages();
error BundleNotFound(bytes32 bundleRoot);
error InvalidProof(
    bytes32 bundleRoot,
    bytes32 messageId,
    uint256 treeIndex,
    bytes32[] siblings,
    uint256 totalLeaves
);
error IncorrectFee(uint256 requiredFee, uint256 msgValue);
error InvalidRoute(uint256 toChainId);
error InvalidBridgeCaller(address msgSender);
error NotHubBridge(address msgSender);
error InvalidChainId(uint256 chainId);
error NotEnoughFees(uint256 requiredFees, uint256 actualFees);
error NotCrossDomainMessage();
error NoPendingBundle();
error MessageIsSpent(bytes32 bundleId, uint256 treeIndex, bytes32 messageId);
error CannotMessageAddress(address to);
