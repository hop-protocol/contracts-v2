// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

error InvalidCounterpart(address counterpart);
error InvalidBridge(address msgSender);
error InvalidFromChainId(uint256 fromChainId);

abstract contract Connector {
    address public target;
    address public counterpart;

    function initialize(address _target, address _counterpart) public {
        require(target == address(0), "CNR: Target address has already been set");
        require(counterpart == address(0), "CNR: Counterpart has already been set");
        require(_target != address(0), "CNR: Target cannot be zero address");
        require(_counterpart != address(0), "CNR: Counterpart cannot be zero address");

        target = _target;
        counterpart = _counterpart;
    }

    // ToDo: Forward value
    fallback () external payable {
        if (msg.sender == target) {
            _forwardCrossDomainMessage();
        } else {
            _verifyCrossDomainSender();

            (bool success, bytes memory res) = payable(target).call{value: msg.value}(msg.data);
            if (!success) {
                // Bubble up error message
                assembly { revert(add(res,0x20), res) }
            }
        }
    }

    receive () external payable {
        revert("Do not send ETH to this contract");
    }

    /**
     * @dev Sets the counterpart
     * @param _counterpart The new bridge connector address
     */
    function setCounterpart(address _counterpart) public {
        require(counterpart == address(0), "CNR: Connector address has already been set");
        counterpart = _counterpart;
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;

    function _verifyCrossDomainSender() internal virtual;
}
