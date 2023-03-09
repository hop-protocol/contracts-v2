//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error InvalidSender(address sender);
error InvalidCrossChainSender(address sender);
error NoZeroChainId();
error InvalidChainId(uint256 chainId);

error TokenAlreadyMinted(uint256 tokenId);
error UnsupportedChainId(uint256 chainId);
error TokenDoesNotExist(uint256 tokenId);

error TargetAddressAlreadySet(uint256 chainId);
error NoZeroTargetAddress(address targetAddress);