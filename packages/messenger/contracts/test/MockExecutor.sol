//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../messenger/Executor.sol";

contract MockExecutor is Executor {
    uint256 public mockChainId;

    constructor(
        address verificationManager,
        uint256 _mockChainId
    ) Executor (
        verificationManager
    ) {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}