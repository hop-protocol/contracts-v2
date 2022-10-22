// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/arbitrum/CrossChainEnabledArbitrumL2.sol";
import "./Connector.sol";

contract L2ArbitrumConnector is Connector, CrossChainEnabledArbitrumL2 {
    constructor(address target) Connector(target) {}

    function _forwardCrossDomainMessage() internal override {
        // ToDo
    }
}
