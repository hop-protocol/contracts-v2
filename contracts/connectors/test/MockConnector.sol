// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../Connector.sol";

error MockRelayFailed();
error NoPendingMessage();

contract MockConnector is Connector {
    bytes public pendingMessage;

    function relay() public {
        bytes memory _pendingMessage = pendingMessage;
        delete pendingMessage;
        if (_pendingMessage.length == 0) revert NoPendingMessage();
        (bool success, bytes memory res) = counterpart.call(_pendingMessage);
        if(!success) {
            // Bubble up error message
            assembly { revert(add(res,0x20), res) }
        }
    }

    function _forwardCrossDomainMessage() internal override {
        pendingMessage = msg.data;
    }

    function _verifyCrossDomainSender() internal view override {
        if (msg.sender != counterpart) revert InvalidCounterpart(msg.sender);
    }
}
