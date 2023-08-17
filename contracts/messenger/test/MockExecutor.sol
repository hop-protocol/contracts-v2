//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../messenger/ExecutorManager.sol";

contract MockExecutorManager is ExecutorManager {
    uint256 public mockChainId;

    constructor(
        address defaultTransporter,
        uint256 _mockChainId
    ) ExecutorManager (
        defaultTransporter
    ) {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}