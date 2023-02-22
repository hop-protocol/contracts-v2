// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ERC721Bridge.sol";

abstract contract ERC721BridgeMultiHub is ERC721Bridge {

    uint256 public immutable minTokenIndex;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _maxTokenIndex,
        uint256 _minTokenIndex
    )
        ERC721Bridge(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _maxTokenIndex
        )
    {
        if (_minTokenIndex > _maxTokenIndex) revert InvalidTokenIndexes(_minTokenIndex, _maxTokenIndex);
        minTokenIndex = _minTokenIndex;
    }

    function isHub(uint256 tokenId) public view override returns (bool) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        bool isSpoke = minTokenIndex == maxTokenIndex;
        bool isTokenOnHub = (
            tokenIndex >= minTokenIndex &&
            tokenIndex <= maxTokenIndex
        );
        return !isSpoke && isTokenOnHub;
    }
}