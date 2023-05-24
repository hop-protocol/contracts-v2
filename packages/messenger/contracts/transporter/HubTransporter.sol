//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Transporter.sol";
import "hardhat/console.sol";

interface ISpokeTransporter {
    function receiveCommitment(uint256 fromChainId, bytes32 commitment) external payable;
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
    event FeePaid(address indexed to, uint256 amount, uint256 feesCollected);
    event ExcessFeesSkimmed(uint256 excessFees);

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;

    /* config */
    mapping(address => uint256) private chainIdForSpokeConnector;
    mapping(uint256 => address) private spokeConnectorForChainId;
    mapping(uint256 => uint256) private exitTimeForChainId;
    address public excessFeesRecipient;
    uint256 public targetBalance;
    uint256 public pendingFeeBatchSize;
    uint256 public relayWindow;
    uint256 public maxBundleFee;
    uint256 public maxBundleFeeBPS;

    mapping(uint256 => address) public feeTokens;

    /* state */
    uint256 public virtualBalance;

    constructor(
        address _excessFeesRecipient,
        uint256 _targetBalance,
        uint256 _pendingFeeBatchSize,
        uint256 _relayWindow,
        uint256 _maxBundleFee,
        uint256 _maxBundleFeeBPS
    ) {
        excessFeesRecipient = _excessFeesRecipient;
        targetBalance = _targetBalance;
        pendingFeeBatchSize = _pendingFeeBatchSize;
        relayWindow = _relayWindow;
        maxBundleFee = _maxBundleFee;
        maxBundleFeeBPS = _maxBundleFeeBPS;
    }

    receive() external payable {}

    function transportCommitment(uint256 toChainId, bytes32 commitment) external payable onlyDispatcher {
        address spokeConnector = getSpokeConnector(toChainId);
        ISpokeTransporter spokeTransporter = ISpokeTransporter(spokeConnector);
        
        emit CommitmentTransported(toChainId, commitment, block.timestamp);

        uint256 fromChainId = getChainId();
        spokeTransporter.receiveCommitment{value: msg.value}(fromChainId, commitment); // Forward value for message fee
    }

    // ToDo: only spoke connector
    function receiveOrForwardCommitment(
        bytes32 commitment,
        uint256 transportFee,
        uint256 toChainId,
        uint256 commitTime
    )
        external
        payable
    {
        uint256 fromChainId = getSpokeChainId(msg.sender);

        if (toChainId == getChainId()) {
            _setProvenCommitment(fromChainId, commitment);
        } else {
            address spokeConnector = getSpokeConnector(toChainId);
            ISpokeTransporter spokeTransporter = ISpokeTransporter(spokeConnector);

            emit CommitmentForwarded(fromChainId, toChainId, commitment);
            // Forward value for cross-chain message fee
            spokeTransporter.receiveCommitment{value: msg.value}(fromChainId, commitment);
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
        // ToDo: Calculate fee
        _payFee(tx.origin, fromChainId, relayWindowStart, transportFee);
    }

    // ToDo: Handle ERC20
    function transfer(address to, uint256 amount) internal virtual {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }

    function skimExcessFees() external onlyOwner {
        uint256 balance = getBalance();
        if (targetBalance > balance) revert PoolNotFull(balance, targetBalance);
        uint256 excessBalance = balance - targetBalance;

        virtualBalance -= excessBalance;

        emit ExcessFeesSkimmed(excessBalance);

        transfer(excessFeesRecipient, excessBalance);
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

    function setExcessFeeRecipient(address _excessFeesRecipient) external onlyOwner {
        if (_excessFeesRecipient == address(0)) revert NoZeroAddress();

        excessFeesRecipient = _excessFeesRecipient;
        emit ConfigUpdated();
    }

    function setTargetBalanceSize(uint256 _targetBalance) external onlyOwner {
        targetBalance = _targetBalance;

        emit ConfigUpdated();
    }

    // @notice When lowering pendingFeeBatchSize, the Spoke pendingFeeBatchSize should be lowered first and
    // all fees should be exited before lowering pendingFeeBatchSize on the Hub.
    // @notice When raising pendingFeeBatchSize, both the Hub and Spoke pendingFeeBatchSize can be set at the
    // same time.
    function setPendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        uint256 balance = getBalance();
        uint256 pendingAmount = virtualBalance - balance; // ToDo: Handle balance greater than fee pool
        if (_pendingFeeBatchSize < pendingAmount) revert PendingFeeBatchSizeTooLow(_pendingFeeBatchSize);

        pendingFeeBatchSize = _pendingFeeBatchSize;

        emit ConfigUpdated();
    }

    function setRelayWindow(uint256 _relayWindow) external onlyOwner {
        if (_relayWindow == 0) revert NoZeroRelayWindow();
        relayWindow = _relayWindow;
        emit ConfigUpdated();
    }

    function setMaxBundleFee(uint256 _maxBundleFee) external onlyOwner {
        maxBundleFee = _maxBundleFee;
        emit ConfigUpdated();
    }

    function setMaxBundleFeeBPS(uint256 _maxBundleFeeBPS) external onlyOwner {
        maxBundleFeeBPS = _maxBundleFeeBPS;
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
            revert InvalidCaller(connector);
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
        return (block.timestamp - relayWindowStart) * feesCollected / relayWindow;
    }

    /*
     * Internal functions
     */
    function _payFee(address to, uint256 fromChainId, uint256 relayWindowStart, uint256 feesCollected) internal {
        address feeToken = feeTokens[fromChainId];
        if (feeToken != address(0)) {
            // ToDo: Use explicit address for ETH
            revert(); // ToDO: Handle ERC20 fees
        }

        uint256 relayReward = 0;
        if (block.timestamp >= relayWindowStart) {
            relayReward = getRelayReward(relayWindowStart, feesCollected);
        } else {
            return;
        }

        uint256 maxFee = feesCollected * maxBundleFeeBPS / BASIS_POINTS;
        if (maxFee > maxBundleFee) maxFee = maxBundleFee;
        if (relayReward > maxFee) relayReward = maxFee;

        uint256 balance = getBalance();
        uint256 pendingAmount = virtualBalance + feesCollected - balance;
        if (pendingAmount > pendingFeeBatchSize) {
            revert PendingFeesTooHigh(pendingAmount, pendingFeeBatchSize);
        }

        virtualBalance = virtualBalance + feesCollected - relayReward;

        emit FeePaid(to, relayReward, feesCollected);

        transfer(to, relayReward);
    }
}
