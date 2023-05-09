//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IBundleTransporter.sol";
import "./BundleTransporter.sol";
import "./IHubBundleTransporter.sol";
import "../../libraries/Error.sol";

contract SpokeBundleTransporter is Ownable, BundleTransporter {
    /* events */
    event FeesSentToHub(uint256 amount);

    /* constants */
    uint256 public immutable hubChainId;

    /* config*/
    address public hubBridgeConnector;
    address public hubFeeDistributor;
    uint256 public pendingFeeBatchSize;

    /* state */
    mapping(uint256 => bytes32) public pendingBundleIdForChainId;
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingFeesForChainId;
    uint256 public totalFeesForHub;

    modifier onlyBundler() {
        // ToDo
        _;
    }

    modifier onlyHub() {
        if (msg.sender != hubBridgeConnector) {
            revert NotHubBridge(msg.sender);
        }
        _;
    }

    function transportBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 toChainId) external payable onlyBundler {
        uint256 bundleFees = msg.value;

        emit BundleDispatched(bundleId, bundleRoot, bundleFees, toChainId, block.timestamp);

        IHubBundleTransporter(hubBridgeConnector).receiveOrForwardMessageBundle(
            bundleId,
            bundleRoot,
            bundleFees,
            toChainId,
            block.timestamp
        );

        // Collect fees
        totalFeesForHub += bundleFees;
        uint256 _totalFeesForHub = totalFeesForHub;
        if (_totalFeesForHub >= pendingFeeBatchSize) {
            // Send fees to l1
            totalFeesForHub = 0;
            _sendFeesToHub(_totalFeesForHub);
        }
    }

    function receiveMessageBundle(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 fromChainId
    )
        external
        /** onlyHub ToDo */
    {
        _setBundle(bundleId, bundleRoot, fromChainId);
    }

    /* Setters */

    function setHubBridge(address _hubBridgeConnector, address _hubFeeDistributor) public onlyOwner {
        if (_hubBridgeConnector == address(0)) revert NoZeroAddress();
        if (_hubFeeDistributor == address(0)) revert NoZeroAddress();

        hubBridgeConnector = _hubBridgeConnector;
        hubFeeDistributor = _hubFeeDistributor;
    }

    /// @notice `pendingFeeBatchSize` of 0 will flush the pending fees for every bundle.
    function setpendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }

    /* Internal */
    function _sendFeesToHub(uint256 amount) internal virtual {
        emit FeesSentToHub(amount);

        // ToDo: Make cross-chain payment
        (bool success, ) = hubFeeDistributor.call{value: amount}("");
        if (!success) revert(); // TransferFailed(to, amount);
    }
}
