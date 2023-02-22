// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ERC721Bridge.sol";

abstract contract ERC721BridgeMultiHub is ERC721Bridge {

    uint256 public immutable minTokenIndex;
    uint256 public immutable maxTokenIndex;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _minTokenIndex,
        uint256 _maxTokenIndex
    )
        ERC721Bridge(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        if (_maxTokenIndex > type(uint96).max) revert TokenIndexTooLarge(_maxTokenIndex);
        if (_minTokenIndex > _maxTokenIndex) revert InvalidTokenIndexes(_minTokenIndex, _maxTokenIndex);
        minTokenIndex = _minTokenIndex;
        maxTokenIndex = _maxTokenIndex;
    }

    function isSpoke() public view virtual override returns (bool) {
        // Do not check if these are equal, since it is possible to have a 1 of 1 NFT with equal, non-zero min/max token indexes
        return minTokenIndex == 0 && maxTokenIndex == 0;
    }

    function isTokenIdConfirmableAdditionalChecks(uint256 tokenId) public view virtual override returns (bool) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        bool isTokenIndexWithinBounds = (
            tokenIndex >= minTokenIndex &&
            tokenIndex <= maxTokenIndex
        );
        return isTokenIndexWithinBounds;
    }
}