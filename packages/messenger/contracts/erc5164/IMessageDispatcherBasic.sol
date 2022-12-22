//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IMessageDispatcher.sol";

interface IMessageDispatcherBasic is IMessageDispatcher {
    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    ) external payable returns (bytes32);
}
