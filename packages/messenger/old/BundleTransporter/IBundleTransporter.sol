//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface IBundleTransporter {
    function transportBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 toChainId) external payable;
    function bundleIsValid(bytes32 bundleId, bytes32 bundleRoot, uint256 fromChainId) external view returns (bool);
}
