//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

contract FeeSplitter is Ownable {
    /* errors */
    error NoZeroAddress();
    error TransferFailed(address to, uint256 amount);
    error InvalidPublicGoodsBps(uint256 publicGoodsBps);

    /* events */
    event TreasurySet(address indexed treasury);
    event PublicGoodsSet(address indexed publicGoods);
    event PublicGoodsBpsSet(uint256 publicGoodsBps);
    event FeesDistributed(uint256 treasuryAmount, uint256 publicGoodsAmount);

    /* constants */
    uint256 constant BASIS_POINTS = 10_000;
    uint256 constant ONE_HUNDRED_PERCENT_BPS = 1_000_000;
    uint256 public immutable minPublicGoodsBps;

    /* config */
    address public treasury;
    address public publicGoods;
    uint256 public publicGoodsBps;

    constructor(
        address _treasury,
        address _publicGoods,
        uint256 _minPublicGoodsBps
    ) {
        treasury = _treasury;
        publicGoods = _publicGoods;
        minPublicGoodsBps = _minPublicGoodsBps;
        publicGoodsBps = _minPublicGoodsBps;
    }

    receive() external payable {}

    function transfer(address to, uint256 amount) internal {
        // ToDo: handle ERC20
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }

    function distribute(address token) external onlyOwner {
        // ToDo: handle ERC20
        // uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 balance = address(this).balance;

        uint256 publicGoodsAmount = balance * publicGoodsBps / BASIS_POINTS;
        uint256 treasuryAmount = balance - publicGoodsAmount;

        emit FeesDistributed(treasuryAmount, publicGoodsAmount);

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

    function setPublicGoodsBps(uint256 _publicGoodsBps) external onlyOwner {
        if (_publicGoodsBps < minPublicGoodsBps || _publicGoodsBps > ONE_HUNDRED_PERCENT_BPS) {
            revert InvalidPublicGoodsBps(_publicGoodsBps);
        }
        publicGoodsBps = _publicGoodsBps;

        emit PublicGoodsBpsSet(_publicGoodsBps);
    }
}
