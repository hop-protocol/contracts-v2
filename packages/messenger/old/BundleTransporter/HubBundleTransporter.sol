//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./BundleTransporter.sol";

contract HubBundleTransporter is BundleTransporter {
    /* events */
    event BundleReceived(
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 relayWindowStart,
        address indexed relayer
    );
    event BundleForwarded(
        bytes32 indexed bundleId,
        bytes32 bundleRoot,
        uint256 indexed fromChainId,
        uint256 indexed toChainId
    );
    event ConfigUpdated();
    event FeePaid(address indexed to, uint256 amount, uint256 feesCollected);
    event ExcessFeesSkimmed(uint256 publicGoodsAmount, uint256 treasuryAmount);

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;

    /* config */
    mapping(address => uint256) private chainIdForSpokeBridge;
    mapping(uint256 => ISpokeMessageBridge) private spokeBridgeForChainId;
    mapping(uint256 => uint256) private exitTimeForChainId;
    mapping(uint256 => FeeDistributor) private feeDistributorForChainId;
    address public excessFeeRecipient;
    uint256 public fullPoolSize;
    uint256 public pendingFeeBatchSize;
    uint256 public relayWindow = 12 hours;
    uint256 public maxBundleFee;
    uint256 public maxBundleFeeBPS;

    /* state */
    uint256 public virtualBalance;

    constructor(
        address _excessFeeRecipient,
        uint256 _fullPoolSize,
        uint256 _maxBundleFee,
        uint256 _maxBundleFeeBPS
    ) {
        excessFeeRecipient = _excessFeeRecipient;
        fullPoolSize = _fullPoolSize;
        maxBundleFee = _maxBundleFee;
        maxBundleFeeBPS = _maxBundleFeeBPS;
    }

    receive() external payable {}

    function receiveOrForwardMessageBundle(
        bytes32 bundleId,
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 toChainId,
        uint256 commitTime
    )
        external
    {
        uint256 fromChainId = getSpokeChainId(msg.sender);

        if (toChainId == getChainId()) {
            _setBundle(bundleId, bundleRoot, fromChainId);
        } else {
            ISpokeMessageBridge spokeBridge = getSpokeBridge(toChainId);
            emit BundleForwarded(bundleId, bundleRoot, fromChainId, toChainId);
            spokeBridge.receiveMessageBundle(bundleId, bundleRoot, fromChainId);
        }

        // Pay relayer
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        emit BundleReceived(
            bundleId,
            bundleRoot,
            bundleFees,
            fromChainId,
            toChainId,
            relayWindowStart,
            tx.origin
        );
        _payFee(tx.origin, fromChainId, relayWindowStart, bundleFees);
    }

    function transfer(address to, uint256 amount) internal virtual;

    function skimExcessFees() external onlyOwner {
        uint256 poolSize = getBalance();
        if (poolSize < fullPoolSize) revert PoolNotFull(poolSize, fullPoolSize);
        uint256 excessAmount = poolSize - fullPoolSize;

        virtualBalance -= excessAmount;

        emit ExcessFeesSkimmed(amount);

        transfer(publicGoods, publicGoodsAmount);
        transfer(treasury, treasuryAmount);
    }

    /* setters */

    function setSpokeBridge(
        uint256 chainId,
        address spokeBridge,
        uint256 exitTime,
        address payable feeDistributor
    )
        external
        onlyOwner
    {
        if (chainId == 0) revert NoZeroChainId();
        if (spokeBridge == address(0)) revert NoZeroAddress(); 
        if (exitTime == 0) revert NoZeroExitTime();
        if (feeDistributor == address(0)) revert NoZeroAddress(); 

        noMessageList[spokeBridge] = true;
        chainIdForSpokeBridge[spokeBridge] = chainId;
        spokeBridgeForChainId[chainId] = ISpokeMessageBridge(spokeBridge);
        exitTimeForChainId[chainId] = exitTime;
        feeDistributorForChainId[chainId] = FeeDistributor(feeDistributor);
    }

    function setExcessFeeRecipient(address _excessFeeRecipient) external onlyOwner {
        if (_excessFeeRecipient == address(0)) revert NoZeroAddress();

        excessFeeRecipient = _excessFeeRecipient;
        emit ConfigUpdated();
    }

    function setFullPoolSize(uint256 _fullPoolSize) external onlyOwner {
        fullPoolSize = _fullPoolSize;

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

    function getSpokeBridge(uint256 chainId) public view returns (ISpokeMessageBridge) {
        ISpokeMessageBridge bridge = spokeBridgeForChainId[chainId];
        if (address(bridge) == address(0)) {
            revert InvalidRoute(chainId);
        }
        return bridge;
    }

    function getSpokeChainId(address bridge) public view returns (uint256) {
        uint256 chainId = chainIdForSpokeBridge[bridge];
        if (chainId == 0) {
            revert InvalidBridgeCaller(bridge);
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

    function getRelayReward(
        uint256 fromChainId,
        uint256 bundleFees,
        uint256 commitTime
    )
        public
        view
        returns (uint256)
    {
        uint256 relayWindowStart = commitTime + getSpokeExitTime(fromChainId);
        FeeDistributor feeDistributor = getFeeDistributor(fromChainId);
        return feeDistributor.getRelayReward(relayWindowStart, bundleFees);
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
        address feeToken = feeToken[fromChainId];
        if (feeToken) {
            // ToDo: Use explicit address for ETH
            revert; // ToDO: Handle ERC20 fees
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
