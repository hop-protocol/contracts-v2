// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/polygon/CrossChainEnabledPolygonChild.sol";
import "./Connector.sol";

contract L1PolygonConnector is Connector, CrossChainEnabledPolygonChild {
    constructor(
        address target,
        address bridge
    )
        Connector(target)
        CrossChainEnabledPolygonChild(bridge)
    {}

    function _forwardCrossDomainMessage() internal override {
        // ToDo
    }
}
