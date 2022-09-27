//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./FeeDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ERC20FeeDistributor is FeeDistributor {
    using SafeERC20 for IERC20;

    IERC20 feeToken;

    constructor(
        address _hubBridge,
        address _treasury,
        address _publicGoods,
        uint256 _minPublicGoodsBps,
        uint256 _fullPoolSize,
        IERC20 _feeToken
    ) 
        FeeDistributor(
            _hubBridge,
            _treasury,
            _publicGoods,
            _minPublicGoodsBps,
            _fullPoolSize
        )
    {
        feeToken = _feeToken;
    }

    function transfer(address to, uint256 amount) internal override {
        feeToken.safeTransfer(to, amount);
    }
}
