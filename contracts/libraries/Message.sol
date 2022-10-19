//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

struct Message {
    bytes32 bundleId;
    uint256 treeIndex;
    uint256 fromChainId;
    address from;
    uint256 toChainId;
    address to;
    bytes data;
}

library MessageLibrary {
    function getMessageId(Message memory message) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                message.bundleId,
                message.treeIndex,
                message.fromChainId,
                message.from,
                message.toChainId,
                message.to,
                message.data
            )
        );
    }
}