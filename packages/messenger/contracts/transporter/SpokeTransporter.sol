//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Transporter.sol";
import "./HubTransporter.sol";

interface IHubBundleTransporterer {
    function receiveOrForwardCommitment(
        bytes32 commitment,
        uint256 commitmentFees,
        uint256 toChainId,
        uint256 commitTime
    ) external;
}

contract SpokeTransporter is Ownable, Transporter {
    /* events */
    event FeesSentToHub(uint256 amount);

    /* constants */
    uint256 public immutable hubChainId;

    /* config*/
    address public hubTransporter;
    address public hubTransporterConnector;
    uint256 public pendingFeeBatchSize;

    /* state */
    mapping(uint256 => bytes32) public pendingBundleIdForChainId;
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingFeesForChainId;
    uint256 public totalFeesForHub;

    modifier onlyHub() {
        if (msg.sender != hubTransporterConnector) {
            revert NotHub(msg.sender);
        }
        _;
    }

    constructor(
        uint256 _hubChainId,
        uint256 _pendingFeeBatchSize
    ) {
        hubChainId = _hubChainId;
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }

    function dispatchCommitment(uint256 toChainId, bytes32 commitment) external payable onlyDispatcher {

        emit CommitmentDispatched(toChainId, commitment, block.timestamp);

        uint256 fee = msg.value;
        IHubBundleTransporterer(hubTransporterConnector).receiveOrForwardCommitment(
            commitment,
            fee,
            toChainId,
            block.timestamp
        );

        // Collect fees
        totalFeesForHub += fee;
        uint256 _totalFeesForHub = totalFeesForHub;
        if (_totalFeesForHub >= pendingFeeBatchSize) {
            // Send fees to l1
            totalFeesForHub = 0;
            _sendFeesToHub(_totalFeesForHub);
        }
    }

    function receiveCommitment(uint256 fromChainId, bytes32 commitment) external onlyHub {
        _setProvenCommitment(fromChainId, commitment);
    }

    /* Setters */

    function setHubTransporter(address _hubTransporter, address _hubTransporterConnector) public onlyOwner {
        if (_hubTransporter == address(0)) revert NoZeroAddress();
        if (_hubTransporterConnector == address(0)) revert NoZeroAddress();

        hubTransporter = _hubTransporter;
        hubTransporterConnector = _hubTransporterConnector;
    }

    /// @notice `pendingFeeBatchSize` of 0 will flush the pending fees for every bundle.
    function setpendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }

    /* Internal */
    function _sendFeesToHub(uint256 amount) internal virtual {
        emit FeesSentToHub(amount);

        // ToDo: Make cross-chain payment
        (bool success, ) = hubTransporter.call{value: amount}("");
        if (!success) revert(); // TransferFailed(to, amount);
    }
}
