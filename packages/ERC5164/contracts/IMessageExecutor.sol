//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface IMessageExecutor {
    error CallsAlreadyExecuted(bytes32 messageId);

    event MessageExecuted(
        uint256 indexed fromChainId,
        bytes32 indexed messageId
    );
}
