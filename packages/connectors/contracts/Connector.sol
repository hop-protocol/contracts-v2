// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

error InvalidCounterpart(address counterpart);
error InvalidBridge(address msgSender);
error InvalidFromChainId(uint256 fromChainId);

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

            (bool success, bytes memory res) = target.call(msg.data);
            if(!success) {
                // Bubble up error message
                assembly { revert(add(res,0x20), res) }
            }
        }
    }

    /**
     * @dev Sets the counterpart
     * @param _counterpart The new bridge connector address
     */
    function setCounterpart(address _counterpart) external {
        require(counterpart == address(0), "CNR: Connector address has already been set");
        counterpart = _counterpart;
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;

    function _verifyCrossDomainSender() internal virtual;
}
