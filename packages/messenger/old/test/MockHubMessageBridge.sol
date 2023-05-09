//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../bridge/HubMessageBridge.sol";

contract MockHubMessageBridge is HubMessageBridge {
    uint256 public mockChainId;

    constructor(uint256 _mockChainId) {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}
