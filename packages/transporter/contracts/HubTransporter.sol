//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./Transporter.sol";

interface ISpokeTransporter {
    function receiveCommitment(uint256 fromChainId, bytes32 commitment) external payable;
    function payRelayerFee(address relayer, uint256 relayerFee, bytes32 commitment) external;
}

contract HubTransporter is Transporter {
    /* events */
    event CommitmentRelayed(
        uint256 indexed fromChainId,
        uint256 toChainId,
        bytes32 indexed commitment,
        uint256 transportFee,
        uint256 relayWindowStart,
        address indexed relayer
    );

    event CommitmentForwarded(
        uint256 indexed fromChainId,
        uint256 indexed toChainId,
        bytes32 indexed commitment
    );
    event ConfigUpdated();

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;

    /* config */
    mapping(address => uint256) private chainIdForSpokeConnector;
    mapping(uint256 => address) private spokeConnectorForChainId;
    mapping(uint256 => uint256) private exitTimeForChainId;
    uint256 public relayWindow;
    uint256 public absoluteMaxFee;
    uint256 public maxFeeBPS;

    constructor(
        uint256 _relayWindow,
        uint256 _absoluteMaxFee,
        uint256 _maxFeeBPS
    ) {
        relayWindow = _relayWindow;
        absoluteMaxFee = _absoluteMaxFee;
        maxFeeBPS = _maxFeeBPS;
    }

    receive() external payable {}

    function dispatchCommitment(uint256 toChainId, bytes32 commitment) external payable onlyDispatcher {
        address spokeConnector = getSpokeConnector(toChainId);
        ISpokeTransporter spokeTransporter = ISpokeTransporter(spokeConnector);
        
        emit CommitmentDispatched(toChainId, commitment, block.timestamp);

        uint256 fromChainId = getChainId();
        spokeTransporter.receiveCommitment{value: msg.value}(fromChainId, commitment); // Forward value for message fee
    }

    function receiveOrForwardCommitment(
        bytes32 commitment,
        uint256 transportFee,
        uint256 toChainId,
        uint256 commitTime
    )
        external
        payable
    {
        // getSpokeChainId will revert for invalid msg.senders
        uint256 fromChainId = getSpokeChainId(msg.sender);

        if (toChainId == getChainId()) {
            _setProvenCommitment(fromChainId, commitment);
        } else {
            address toSpokeConnector = getSpokeConnector(toChainId);
            ISpokeTransporter toSpokeTransporter = ISpokeTransporter(toSpokeConnector);

            emit CommitmentForwarded(fromChainId, toChainId, commitment);
            // Forward value for cross-chain message fee
            toSpokeTransporter.receiveCommitment{value: msg.value}(fromChainId, commitment);
        }

        // Pay relayer
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        emit CommitmentProven(
            fromChainId,
            commitment
        );

        emit CommitmentRelayed(
            fromChainId,
            toChainId,
            commitment,
            transportFee,
            relayWindowStart,
            tx.origin
        );

        uint256 relayReward = getRelayReward(relayWindowStart, transportFee);
        address fromSpokeConnector = getSpokeConnector(fromChainId);
        ISpokeTransporter fromSpokeTransporter = ISpokeTransporter(fromSpokeConnector);
        fromSpokeTransporter.payRelayerFee(tx.origin, relayReward, commitment);
    }

    /* setters */

    function setSpokeConnector(
        uint256 chainId,
        address connector,
        uint256 exitTime
    )
        external
        onlyOwner
    {
        if (chainId == 0) revert NoZeroChainId();
        if (connector == address(0)) revert NoZeroAddress(); 
        if (exitTime == 0) revert NoZeroExitTime();

        chainIdForSpokeConnector[connector] = chainId;
        spokeConnectorForChainId[chainId] = connector;
        exitTimeForChainId[chainId] = exitTime;
    }

    function setRelayWindow(uint256 _relayWindow) external onlyOwner {
        if (_relayWindow == 0) revert NoZeroRelayWindow();
        relayWindow = _relayWindow;
        emit ConfigUpdated();
    }

    function setAbsoluteMaxFee(uint256 _absoluteMaxFee) external onlyOwner {
        absoluteMaxFee = _absoluteMaxFee;
        emit ConfigUpdated();
    }

    function setMaxFeeBPS(uint256 _maxFeeBPS) external onlyOwner {
        maxFeeBPS = _maxFeeBPS;
        emit ConfigUpdated();
    }

    /* getters */

    function getSpokeConnector(uint256 chainId) public view returns (address) {
        address spoke = spokeConnectorForChainId[chainId];
        if (spoke == address(0)) {
            revert InvalidRoute(chainId);
        }
        return spoke;
    }

    function getSpokeChainId(address connector) public view returns (uint256) {
        uint256 chainId = chainIdForSpokeConnector[connector];
        if (chainId == 0) {
            revert InvalidSender(connector);
        }
        return chainId;
    }

    function getSpokeExitTime(uint256 chainId) public view returns (uint256) {
        uint256 exitTime = exitTimeForChainId[chainId];
        if (exitTime == 0) {
            revert InvalidChainId(chainId);
        }
        return exitTime;
    }

    function getBalance() private view returns (uint256) {
        // ToDo: Handle ERC20
        return address(this).balance;
    }

    function getRelayReward(uint256 relayWindowStart, uint256 feesCollected) public view returns (uint256) {
        if (relayWindowStart >= block.timestamp) return 0;
        uint256 relayReward = (block.timestamp - relayWindowStart) * feesCollected / relayWindow;
        uint256 relativeMaxFee = feesCollected * maxFeeBPS / BASIS_POINTS;
        uint256 maxFee = Math.min(relativeMaxFee, absoluteMaxFee);
        return Math.min(relayReward, maxFee);
    }
}
