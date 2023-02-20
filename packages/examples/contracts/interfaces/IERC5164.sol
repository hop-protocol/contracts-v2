// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IERC5164 {
  function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32 messageId);
}