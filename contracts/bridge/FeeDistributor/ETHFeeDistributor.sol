//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./FeeDistributor.sol";

contract ETHFeeDistributor is FeeDistributor {
    constructor(
        address _hubBridge,
        address _treasury,
        address _publicGoods,
        uint256 _minPublicGoodsBps,
        uint256 _fullPoolSize,
        uint256 _maxBundleFee,
        uint256 _maxBundleFeeBPS
    ) 
        FeeDistributor(
            _hubBridge,
            _treasury,
            _publicGoods,
            _minPublicGoodsBps,
            _fullPoolSize,
            _maxBundleFee,
            _maxBundleFeeBPS
        )
    {}

    function transfer(address to, uint256 amount) internal override {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }
}
