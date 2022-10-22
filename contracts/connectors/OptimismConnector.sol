// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/optimism/CrossChainEnabledOptimism.sol";
import "./Connector.sol";

contract L1OptimismConnector is Connector, CrossChainEnabledOptimism {
    constructor(
        address target,
        address bridge
    )
        Connector(target)
        CrossChainEnabledOptimism(bridge)
    {}

    function _forwardCrossDomainMessage() internal override {
        // ToDo
    }
}
