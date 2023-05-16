//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../transporter/SpokeTransporter.sol";

contract MockSpokeTransporter is SpokeTransporter {
    uint256 public mockChainId;

    constructor(
        uint256 hubChainId,
        uint256 pendingFeeBatchSize,
        uint256 _mockChainId
    )
        SpokeTransporter(hubChainId, pendingFeeBatchSize)
    {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}
