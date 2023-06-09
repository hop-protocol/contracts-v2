// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "../utils/ExecutorLib.sol";
import "../utils/Initializable.sol";

error InvalidCounterpart(address counterpart);
error InvalidBridge(address msgSender);
error InvalidFromChainId(uint256 fromChainId);

abstract contract Connector is Initializable {
    using ExecutorLib for address;

    address public target;
    address public counterpart;

    /// @dev initialize to keep creation code consistent for create2 deployments
    function initialize(address _target, address _counterpart) public initializer {
        require(_target != address(0), "CNR: Target cannot be zero address");
        require(_counterpart != address(0), "CNR: Counterpart cannot be zero address");

        target = _target;
        counterpart = _counterpart;
    }

    fallback () external payable {
        if (msg.sender == target) {
            _forwardCrossDomainMessage();
        } else {
            _verifyCrossDomainSender();
            target.execute(msg.data, msg.value);
        }
    }

    receive () external payable {
        revert("Do not send ETH to this contract");
    }

    /* ========== Virtual functions ========== */

    function _forwardCrossDomainMessage() internal virtual;

    function _verifyCrossDomainSender() internal virtual;
}
