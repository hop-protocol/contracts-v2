// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

error NotCounterpart();

abstract contract Connector {
    address public target;
    address public counterpart;

    constructor(address _target) {
        target = _target;
    }

    fallback () external {
        if (msg.sender == target) {
            _forwardCrossDomainMessage();
        } else {
            _verifyCrossDomainSender();

            (bool success,) = target.call(msg.data);
            require(success, "CNR: Failed to forward message");
        }
    }

    /**
     * @dev Sets the counterpart
     * @param _counterpart The new bridge connector address
     */
    function setCounterpartAddress(address _counterpart) external {
        require(counterpart == address(0), "CNR: Connector address has already been set");
        counterpart = _counterpart;
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;

    function _verifyCrossDomainSender() internal virtual;
}