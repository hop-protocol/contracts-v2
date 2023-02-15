// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/arbitrum/LibArbitrumL2.sol";
import "./interfaces/arbitrum/messengers/IArbSys.sol";
import "./interfaces/arbitrum/messengers/IBridge.sol";
import "./Connector.sol";

contract L2ArbitrumConnector is Connector {
    function _forwardCrossDomainMessage() internal override {
        IArbSys arbSys = IArbSys(LibArbitrumL2.ARBSYS);
        arbSys.sendTxToL1(
            counterpart,
            msg.data
        );
    }

    function _verifyCrossDomainSender() internal override view {
        // crossChainSender is unaliased
        address crossChainSender = LibArbitrumL2.crossChainSender(LibArbitrumL2.ARBSYS);
        if (crossChainSender != counterpart) revert InvalidCounterpart(crossChainSender);
    }
}
