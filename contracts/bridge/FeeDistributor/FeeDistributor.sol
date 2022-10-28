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

    /* events */
    event FeePaid(address indexed to, uint256 amount, uint256 feesCollected);
    event ExcessFeesSkimmed(uint256 publicGoodsAmount, uint256 treasuryAmount);
    event TreasurySet(address indexed treasury);
    event PublicGoodsSet(address indexed publicGoods);
    event FullPoolSizeSet(uint256 indexed fullPoolSize);
    event PublicGoodsBpsSet(uint256 indexed publicGoodsBps);
    event PendingFeeBatchSizeSet(uint256 indexed pendingFeeBatchSize);

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
        uint256 _fullPoolSize
    ) {
        hubBridge = _hubBridge;
        treasury = _treasury;
        publicGoods = _publicGoods;
        minPublicGoodsBps = _minPublicGoodsBps;
        publicGoodsBps = _minPublicGoodsBps;
        fullPoolSize = _fullPoolSize;
    }

    receive() external payable {}

    function transfer(address to, uint256 amount) internal virtual;

    function getBalance() private view returns (uint256) {
        return address(this).balance;
    }

    function payFee(address to, uint256 amount, uint256 feesCollected) external onlyHubBridge {
        uint256 balance = getBalance();
        uint256 pendingAmount = virtualBalance + feesCollected - balance;
        if (pendingAmount > pendingFeeBatchSize) {
            revert PendingFeesTooHigh(pendingAmount, pendingFeeBatchSize);
        }

        virtualBalance = virtualBalance + feesCollected - amount;

        emit FeePaid(to, amount, feesCollected);

        transfer(to, amount);
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
}
