// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/amb/CrossChainEnabledAMB.sol";
import "./Connector.sol";

contract AMBConnector is Connector, CrossChainEnabledAMB {
    constructor(
        address target,
        address bridge
    )
        Connector(target)
        CrossChainEnabledAMB(bridge)
    {}

    function _forwardCrossDomainMessage() internal override {
        // ToDo
    }
}
