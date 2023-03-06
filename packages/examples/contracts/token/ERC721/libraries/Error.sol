//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error NoZeroChainId();

error NoEmptyTokenIds();
error InvalidChainId(uint256 chainId);
error UnsupportedChainId(uint256 chainId);

error InvalidSender(address sender);
error InvalidCrossChainSender(address sender);
error TokenIndexTooLarge(uint256 tokenIndex);
error CannotMint(address to, uint256 tokenId);
error CannotBurn(uint256 tokenId);
error NotImplemented();

/* Extensions */

// ERC721BridgeNative
error InvalidTokenIndexes(uint256 minTokenIndex, uint256 maxTokenIndex);

// ERC721BridgeWrapper
error NotConfirmed(uint256 tokenId);
error CallerNotUnderlying(address caller);