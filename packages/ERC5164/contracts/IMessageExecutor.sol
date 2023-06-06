//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface IMessageExecutor {
    error MessageIdAlreadyExecuted(bytes32 messageId);
    error MessageFailure(
        bytes32 messageId,
        bytes errorData
    );

    event MessageIdExecuted(
        uint256 indexed fromChainId,
        bytes32 indexed messageId
    );
}
