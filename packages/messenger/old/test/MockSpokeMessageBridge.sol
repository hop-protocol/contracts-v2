//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../bridge/SpokeMessageBridge.sol";

contract MockSpokeMessageBridge is SpokeMessageBridge {
    uint256 public mockChainId;

    constructor(
        uint256 hubChainId,
        Route[] memory routes,
        uint256 _mockChainId
    )
        SpokeMessageBridge(hubChainId, routes)
    {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}
