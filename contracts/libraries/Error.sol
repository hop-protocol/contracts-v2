//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

error BundleNotFound(bytes32 bundleRoot, bytes32 messageId);
error InvalidProof(
    bytes32 bundleRoot,
    bytes32 messageId,
    uint256 treeIndex,
    bytes32[] siblings,
    uint256 totalLeaves
);
error IncorrectFee(uint256 requiredFee, uint256 msgValue);
error TransferFailed(address to, uint256 amount);
error NoBridge(uint256 chainId);
error InvalidBridgeCaller(address msgSender);
error InvalidChainId(uint256 chainId);
error NotEnoughFees(uint256 requiredFees, uint256 actualFees);
