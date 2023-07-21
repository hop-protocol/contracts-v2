//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ICrossChainFees {
    function getFee(uint256[] calldata chainIds) external view returns (uint256);
}
