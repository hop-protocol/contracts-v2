//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

struct Message {
    uint256 nonce;
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
                message.nonce,
                message.fromChainId,
                message.from,
                message.toChainId,
                message.to,
                message.data
            )
        );
    }
}