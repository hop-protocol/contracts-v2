//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

contract CrossChainEnabled {
    function _crossChainContext()
        internal
        pure
        returns (bytes32 messageId, uint256 fromChainId, address from)
    {
        assembly {
            messageId := calldataload(sub(calldatasize(), 84))
            fromChainId := calldataload(sub(calldatasize(), 52))
            from := shr(96, calldataload(sub(calldatasize(), 20)))
        }
    }
}
