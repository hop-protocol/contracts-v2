//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../messenger/VerificationManager.sol";

contract MockVerificationManager is VerificationManager {
    uint256 public mockChainId;

    constructor(
        address defaultTransporter,
        uint256 _mockChainId
    ) VerificationManager (
        defaultTransporter
    ) {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}