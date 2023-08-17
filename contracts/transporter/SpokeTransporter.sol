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
    event FeePaid(address indexed to, uint256 amount, uint256 feesCollected);
    event ExcessFeesDistributed(address indexed to, uint256 amount);

    /* constants */
    uint256 public immutable hubChainId;

    /* config*/
    address public hubTransporterConnector;
    uint256 public pendingFeeBatchSize;

    /* state */
    mapping(uint256 => bytes32) public pendingBundleNonceForChainId;
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(bytes32 => uint256) public feeForCommitment;
    uint256 public feeReserve;
    uint256 targetReserveSize;
    address public feeCollector;

    modifier onlyHub() {
        if (msg.sender != hubTransporterConnector) {
            revert InvalidSender(msg.sender);
        }
        _;
    }

    constructor(uint256 _hubChainId, uint256 _pendingFeeBatchSize) {
        hubChainId = _hubChainId;
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }

    function dispatchCommitment(uint256 toChainId, bytes32 commitment) external payable onlyDispatcher {
        uint256 fee = msg.value;
        feeForCommitment[commitment] = fee;

        emit CommitmentDispatched(toChainId, commitment, block.timestamp);

        IHubBundleTransporterer(hubTransporterConnector).receiveOrForwardCommitment(
            commitment,
            fee,
            toChainId,
            block.timestamp
        );
    }

    function receiveCommitment(uint256 fromChainId, bytes32 commitment) external onlyHub {
        _setProvenCommitment(fromChainId, commitment);
    }

    /**
     * @dev Pay the relayer for relaying the commitment on L1
     * @notice This function is called by the HubTransporter after the call to
     * `receiveOrForwardCommitment` has been relayed
     * @param relayer The address that relayed the bundle on L1
     * @param relayerFee The amount to pay the relayer
     * @param commitment The commitment being relayed
     */
    function payRelayerFee(address relayer, uint256 relayerFee, bytes32 commitment) external onlyHub {
        uint256 feeCollected = feeForCommitment[commitment];

        if (feeCollected > relayerFee) {
            uint256 feeDifference = feeCollected - relayerFee;
            feeReserve += feeDifference;
        } else if (relayerFee > feeCollected) {
            uint256 feeDifference = relayerFee - feeCollected;
            if (feeDifference > feeReserve) revert FeesExhausted();
            feeReserve -= feeDifference;
        }

        emit FeePaid(relayer, relayerFee, feeCollected);

        (bool success, ) = relayer.call{value: relayerFee}("");
        if (!success) revert TransferFailed(relayer, relayerFee);
    }

    /**
     * @dev Distributes fees in excess of the `targetReserveSize` to the fee collector.
     */
    function distributeFees() external onlyOwner {
        uint256 excessFees = feeReserve - targetReserveSize;
        emit ExcessFeesDistributed(feeCollector, excessFees);
        (bool success, ) = feeCollector.call{value: excessFees}("");
        if (!success) revert TransferFailed(feeCollector, excessFees);
    }

    /* Setters */

    function setHubConnector(address _hubTransporterConnector) public onlyOwner {
        if (_hubTransporterConnector == address(0)) revert NoZeroAddress();

        hubTransporterConnector = _hubTransporterConnector;
    }

    /// @notice `pendingFeeBatchSize` of 0 will flush the pending fees for every bundle.
    function setpendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        pendingFeeBatchSize = _pendingFeeBatchSize;
    }
}
