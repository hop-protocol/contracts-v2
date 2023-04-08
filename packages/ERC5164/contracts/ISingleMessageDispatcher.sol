//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IMessageDispatcher.sol";

// ToDo: Remove interface
interface ISingleMessageDispatcher is IMessageDispatcher {
    function dispatchMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    ) external payable returns (bytes32);
}
