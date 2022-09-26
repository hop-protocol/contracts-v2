//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

// Each Spoke has its own FeeDistributor instance
contract FeeDistributor is Ownable {
    error TransferFailed(address to, uint256 amount);
    error OnlyHubBridge(address msgSender);
    error PendingFeesTooHigh(uint256 pendingAmount, uint256 pendingFeeBatchSize);
    error NoZeroAddress();
    error PublicGoodsBpsTooLow(uint256 publicGoodsBps);
    error PendingFeeBatchSizeTooLow(uint256 pendingFeeBatchSize);

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;
    address public immutable hubBridge;
    uint256 public immutable minPublicGoodsBps;

    /* config */
    address public treasury;
    address public publicGoods;

    uint256 public fullPoolSize;
    uint256 public publicGoodsBps;
    uint256 public pendingFeeBatchSize;

    /* state */
    uint256 public expectedBalance;

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

    function transfer(address to, uint256 amount) private {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }

    function getBalance() private view returns (uint256) {
        return address(this).balance;
    }

    function payFee(address to, uint256 amount, uint256 feesCollected) external onlyHubBridge {
        uint256 balance = getBalance();
        uint256 pendingAmount = expectedBalance + feesCollected - balance;
        if(pendingAmount > pendingFeeBatchSize) {
            revert PendingFeesTooHigh(pendingAmount, pendingFeeBatchSize);
        }

        expectedBalance = expectedBalance + feesCollected - amount;
        transfer(to, amount);
    }

    function skimExcessFees() external onlyOwner {
        uint256 balance = getBalance();
        uint256 excessAmount = balance - fullPoolSize; // ToDo: Add error message
        uint256 publicGoodsAmount = excessAmount * publicGoodsBps / BASIS_POINTS;
        uint256 treasuryAmount = excessAmount - publicGoodsAmount;

        expectedBalance -= excessAmount;

        transfer(publicGoods, publicGoodsAmount);
        transfer(treasury, treasuryAmount);
    }

    /**
     * Setters
     */

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert NoZeroAddress();

        treasury = _treasury;
    }

    function setPublicGoods(address _publicGoods) external onlyOwner {
        if (_publicGoods == address(0)) revert NoZeroAddress();

        publicGoods = _publicGoods;
    }

    function setFullPoolSize(uint256 _fullPoolSize) external onlyOwner {
        fullPoolSize = _fullPoolSize;
    }

    function setPublicGoodsBps(uint256 _publicGoodsBps) external onlyOwner {
        if (_publicGoodsBps < minPublicGoodsBps) revert PublicGoodsBpsTooLow(_publicGoodsBps);
        publicGoodsBps = _publicGoodsBps;
    }

    // @notice When lowering pendingFeeBatchSize, the Spoke pendingFeeBatchSize should be lowered first and
    // all fees should be exited before lowering pendingFeeBatchSize on the Hub.
    // @notice When raising pendingFeeBatchSize, both the Hub and Spoke pendingFeeBatchSize can be set at the
    // same time.
    function setPendingFeeBatchSize(uint256 _pendingFeeBatchSize) external onlyOwner {
        uint256 balance = getBalance();
        uint256 pendingAmount = expectedBalance - balance; // ToDo: Handle balance greater than fee pool
        if (_pendingFeeBatchSize < pendingAmount) revert PendingFeeBatchSizeTooLow(_pendingFeeBatchSize);

        pendingFeeBatchSize = _pendingFeeBatchSize;
    }
}
