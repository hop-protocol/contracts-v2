//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ISpokeMessageBridge {
    function receiveMessageBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 fromChainId) external;
    function forwardMessage(bytes32 messageId, address from, address to, bytes calldata data) external;
}
