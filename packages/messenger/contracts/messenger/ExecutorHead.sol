// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@hop-protocol/ERC5164/contracts/MessageExecutor.sol";

contract ExecutorHead is MessageExecutor, Ownable {
    address public executor;

    function executeMessage(
        bytes32 messageId,
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data
    ) external {
        _execute(messageId, fromChainId, from, to, data);
    }
}
