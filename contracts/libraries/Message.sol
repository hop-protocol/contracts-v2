//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

struct Message {
    uint256 nonce;
    uint256 fromChainId;
    address from;
    address to;
    uint256 value;
    bytes data;
}

library MessageLibrary {
    function getMessageId(Message memory message) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                message.nonce,
                message.fromChainId,
                message.from,
                message.to,
                message.value,
                message.data
            )
        );
    }
}