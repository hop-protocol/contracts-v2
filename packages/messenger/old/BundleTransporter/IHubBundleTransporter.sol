//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface IHubBundleTransporter {
    function receiveOrForwardMessageBundle(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 toChainId,
        uint256 commitTime
    )
        external;
}