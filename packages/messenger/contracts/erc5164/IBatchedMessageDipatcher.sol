//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IMessageDispatcher.sol";

struct Message {
    address to;
    bytes data;
}

interface IBatchedMessageDispatcher is IMessageDispatcher {
    function dispatchMessage(
        uint256 toChainId,
        address to,
        Message[] calldata messages
    ) external payable returns (bytes32);
}
