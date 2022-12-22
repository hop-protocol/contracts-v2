//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

contract CrossChainEnabled {
    function _crossChainContext() internal pure returns (uint256, address) {
        uint256 chainId;
        address from;
        assembly {
            chainId := calldataload(sub(calldatasize(), 52))
            from := shr(96, calldataload(sub(calldatasize(), 20)))
        }
        return (chainId, from);
    }
}
