// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ITransporter {
    /* events */
    event CommitmentTransported(
        uint256 indexed toChainId,
        bytes32 indexed commitment
    );

    event CommitmentProven(
        uint256 indexed fromChainId,
        bytes32 indexed commitment
    );

    function transportCommitment(uint256 toChainId, bytes32 commitment) external payable;
    function isCommitmentProven(uint256 fromChainId, bytes32 commitment) external returns (bool);
    // function proveCommitment(uint256 fromChainId, bytes32 commitment, bytes calldata proof) external returns (bool);
}
