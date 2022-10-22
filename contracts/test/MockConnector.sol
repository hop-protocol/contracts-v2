// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../connectors/Connector.sol";

error MockRelayFailed();

contract MockConnector is Connector {
    bytes public pendingMessage;

    constructor(address target) Connector(target) {}

    function relay() public {
        (bool success,) = counterpart.call(pendingMessage);
        if (!success) revert MockRelayFailed();
    }

    function _forwardCrossDomainMessage() internal override {
        pendingMessage = msg.data;
    }

    function _verifySender() internal view override {
        if (msg.sender != counterpart) revert InvalidSender(msg.sender);
    }

    function _isCrossChain() internal view override returns (bool) {
        return msg.sender == counterpart;
    }
    
    function _crossChainSender() internal view override returns (address) {
        return msg.sender;
    }
}
