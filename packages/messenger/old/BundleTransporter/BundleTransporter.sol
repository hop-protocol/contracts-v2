//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IBundleTransporter.sol";
import "./IHubBundleTransporter.sol";
import "../../libraries/Error.sol";

struct ConfirmedBundle {
    bytes32 root;
    uint256 fromChainId;
}

abstract contract BundleTransporter is Ownable {
    /* events */
    event BundleDispatched(
        bytes32 indexed bundleId,
        bytes32 indexed bundleRoot,
        uint256 bundleFees,
        uint256 indexed toChainId,
        uint256 commitTime
    );

    event BundleConfirmed(
        bytes32 indexed bundleId,
        bytes32 indexed bundleRoot,
        uint256 indexed fromChainId
    );

    mapping(bytes32 => ConfirmedBundle) public confirmedBundles;

    function transportBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 toChainId) external payable virtual;

    function bundleIsValid(bytes32 bundleId, bytes32 bundleRoot, uint256 fromChainId) external view returns (bool) {
        ConfirmedBundle memory bundle = confirmedBundles[bundleId];
        return bundle.root == bundleRoot && bundle.fromChainId == fromChainId;
    }

    function _setBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 fromChainId) internal {
        confirmedBundles[bundleId] = ConfirmedBundle(bundleRoot, fromChainId);
        emit BundleConfirmed(bundleId, bundleRoot, fromChainId);
    }
}
