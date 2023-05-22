//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../messenger/Dispatcher.sol";

contract MockDispatcher is Dispatcher {
    uint256 public mockChainId;

    constructor(
        address transporter,
        Route[] memory routes,
        uint256 _mockChainId
    ) Dispatcher (
        transporter,
        routes
    ) {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}