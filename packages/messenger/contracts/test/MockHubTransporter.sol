//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../transporter/HubTransporter.sol";

contract MockHubTransporter is HubTransporter {
    uint256 public mockChainId;

    constructor(
        address _excessFeesRecipient,
        uint256 _targetBalance,
        uint256 _pendingFeeBatchSize,
        uint256 _relayWindow,
        uint256 _maxBundleFee,
        uint256 _maxBundleFeeBPS,
        uint256 _mockChainId
    )
        HubTransporter (
            _excessFeesRecipient,
            _targetBalance,
            _pendingFeeBatchSize,
            _relayWindow,
            _maxBundleFee,
            _maxBundleFeeBPS
        ) 
    {
        mockChainId = _mockChainId;
    }

    function getChainId() public override view returns (uint256 chainId) {
        return mockChainId;
    }
}
