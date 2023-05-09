// Executor.sol
// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./VerificationManager.sol";

contract Executor {
    VerificationManager public verificationManager;

    /* events */
    event MessageExecuted(
        uint256 indexed fromChainId,
        address indexed from,
        address indexed to,
        bytes data
    );

    constructor(VerificationManager _verificationManager) {
        verificationManager = _verificationManager;
    }

    function executeMessage(
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        bytes32 bundleId,
        bytes32 messageId
    ) external {
        require(
            verificationManager.isMessageVerified(fromChainId, bundleId, messageId, to),
            "Invalid bundle"
        );

        (bool success, ) = to.call(data);
        require(success, "Execution failed");

        emit MessageExecuted(fromChainId, from, to, data);
    }
}
