//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ICrossChainSource {
    event MessageSent(
        bytes32 messageId,
        uint256 nonce,
        address from,
        uint256 toChainId,
        address to,
        bytes data
    );

    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    ) external payable;
}
