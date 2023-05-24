// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ITransportLayer {
    /* events */
    event CommitmentDispatched(
        uint256 indexed toChainId,
        bytes32 indexed commitment,
        uint256 timestamp
    );

    event CommitmentProven(
        uint256 indexed fromChainId,
        bytes32 indexed commitment
    );

    function dispatchCommitment(uint256 toChainId, bytes32 commitment) external payable;
    function isCommitmentProven(uint256 fromChainId, bytes32 commitment) external returns (bool);
}
