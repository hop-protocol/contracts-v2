// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/arbitrum/CrossChainEnabledArbitrumL1.sol";
import "./Connector.sol";

contract L1ArbitrumConnector is Connector, CrossChainEnabledArbitrumL1 {
    constructor(
        address target,
        address bridge
    )
        Connector(target)
        CrossChainEnabledArbitrumL1(bridge)
    {}

    function _forwardCrossDomainMessage() internal override {
        // ToDo
    }
}
