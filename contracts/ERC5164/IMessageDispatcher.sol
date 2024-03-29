//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface IMessageDispatcher {
    event MessageSent(
        bytes32 indexed messageId,
        address indexed from,
        uint256 indexed toChainId,
        address to,
        bytes data
    );

    function dispatchMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    ) external payable returns (bytes32);
}
