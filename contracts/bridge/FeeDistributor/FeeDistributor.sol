//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

// Each Spoke has its own FeeDistributor instance
abstract contract FeeDistributor is Ownable {
    /* errors */
    error TransferFailed(address to, uint256 amount);
    error OnlyHubBridge(address msgSender);
    error PendingFeesTooHigh(uint256 pendingAmount, uint256 pendingFeeBatchSize);
    error NoZeroAddress();
    error InvalidPublicGoodsBps(uint256 publicGoodsBps);
    error PendingFeeBatchSizeTooLow(uint256 pendingFeeBatchSize);
    error PoolNotFull(uint256 poolSize, uint256 fullPoolSize);
    error NoZeroRelayWindow();

    /* events */
    event FeePaid(address indexed to, uint256 amount, uint256 feesCollected);
    event ExcessFeesSkimmed(uint256 publicGoodsAmount, uint256 treasuryAmount);
    event TreasurySet(address indexed treasury);
    event PublicGoodsSet(address indexed publicGoods);
    event FullPoolSizeSet(uint256 fullPoolSize);
    event PublicGoodsBpsSet(uint256 publicGoodsBps);
    event PendingFeeBatchSizeSet(uint256 pendingFeeBatchSize);
    event RelayWindowSet(uint256 relayWindow);
    event MaxBundleFeeSet(uint256 maxBundleFee);
    event MaxBundleFeeBPSSet(uint256 maxBundleFeeBPS);

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;
    uint256 constant ONE_HUNDRED_PERCENT_BPS = 1_000_000;
    address public immutable hubBridge;
    uint256 public immutable minPublicGoodsBps;

    /* config */
    address public treasury;
    address public publicGoods;
    uint256 public fullPoolSize;
    uint256 public publicGoodsBps;
    uint256 public pendingFeeBatchSize;
    uint256 public relayWindow = 12 hours;
    uint256 public maxBundleFee;
    uint256 public maxBundleFeeBPS;

    /* state */
    uint256 public virtualBalance;

    modifier onlyHubBridge() {
        if (msg.sender != hubBridge) {
            revert OnlyHubBridge(msg.sender);
        }
        _;
    }

    constructor(
        address _hubBridge,
        address _treasury,
        address _publicGoods,
        uint256 _minPublicGoodsBps,
        uint256 _fullPoolSize,
        uint256 _maxBundleFee,
        uint256 _maxBundleFeeBPS
    ) {
        hubBridge = _hubBridge;
        treasury = _treasury;
        publicGoods = _publicGoods;
        minPublicGoodsBps = _minPublicGoodsBps;
        publicGoodsBps = _minPublicGoodsBps;
        fullPoolSize = _fullPoolSize;
        maxBundleFee = _maxBundleFee;
        maxBundleFeeBPS = _maxBundleFeeBPS;
    }

    receive() external payable {}

    function transfer(address to, uint256 amount) internal virtual;

    function getBalance() private view returns (uint256) {
        return address(this).balance;
    }

    function payFee(address to, uint256 relayWindowStart, uint256 feesCollected) external onlyHubBridge {
        uint256 relayReward = 0;
        if (block.timestamp >= relayWindowStart) {
            relayReward = (block.timestamp - relayWindowStart) * feesCollected / relayWindow;
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

    function skimExcessFees() external onlyOwner {
        uint256 poolSize = getBalance();
        if (poolSize < fullPoolSize) revert PoolNotFull(poolSize, fullPoolSize);
        uint256 excessAmount = poolSize - fullPoolSize;
        uint256 publicGoodsAmount = excessAmount * publicGoodsBps / BASIS_POINTS;
        uint256 treasuryAmount = excessAmount - publicGoodsAmount;

        virtualBalance -= excessAmount;

        emit ExcessFeesSkimmed(publicGoodsAmount, treasuryAmount);

        transfer(publicGoods, publicGoodsAmount);
        transfer(treasury, treasuryAmount);
    }

    /**
     * Setters
     */

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert NoZeroAddress();

        treasury = _treasury;

        emit TreasurySet(_treasury);
    }

    function setPublicGoods(address _publicGoods) external onlyOwner {
        if (_publicGoods == address(0)) revert NoZeroAddress();

        publicGoods = _publicGoods;

        emit PublicGoodsSet(_publicGoods);
    }

    function setFullPoolSize(uint256 _fullPoolSize) external onlyOwner {
        fullPoolSize = _fullPoolSize;

        emit FullPoolSizeSet(_fullPoolSize);
    }

    function setPublicGoodsBps(uint256 _publicGoodsBps) external onlyOwner {
        if (_publicGoodsBps < minPublicGoodsBps || _publicGoodsBps > ONE_HUNDRED_PERCENT_BPS) {
            revert InvalidPublicGoodsBps(_publicGoodsBps);
        }
        publicGoodsBps = _publicGoodsBps;

        emit PublicGoodsBpsSet(_publicGoodsBps);
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

        emit PendingFeeBatchSizeSet(_pendingFeeBatchSize);
    }

    function setRelayWindow(uint256 _relayWindow) external onlyOwner {
        if (_relayWindow == 0) revert NoZeroRelayWindow();
        relayWindow = _relayWindow;
        emit RelayWindowSet(_relayWindow);
    }

    function setMaxBundleFee(uint256 _maxBundleFee) external onlyOwner {
        maxBundleFee = _maxBundleFee;
        emit MaxBundleFeeSet(_maxBundleFee);
    }

    function setMaxBundleFeeBPS(uint256 _maxBundleFeeBPS) external onlyOwner {
        maxBundleFeeBPS = _maxBundleFeeBPS;
        emit MaxBundleFeeBPSSet(_maxBundleFeeBPS);
    }
}
