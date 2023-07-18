//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../transporter/HubTransporter.sol";

contract MockHubTransporter is HubTransporter {
    uint256 public mockChainId;

    constructor(
        uint256 _relayWindow,
        uint256 _absoluteMaxFee,
        uint256 _maxFeeBPS,
        uint256 _mockChainId
    )
        HubTransporter (
            _relayWindow,
            _absoluteMaxFee,
            _maxFeeBPS
        ) 
    {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}
