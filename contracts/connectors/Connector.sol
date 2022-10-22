// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/CrossChainEnabled.sol";

error InvalidSender(address msgSender);

abstract contract Connector is CrossChainEnabled {
    address public target;
    address public counterpart;

    constructor(address _target) {
        target = _target;
    }

    fallback () external {
        if (msg.sender == target) {
            _forwardCrossDomainMessage();
        } else {
            _verifySender();

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

    function _verifySender() onlyCrossChainSender(counterpart) internal virtual {}

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;
}