// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721/ERC721Bridge.sol";

contract ERC721BridgeMock is ERC721Bridge {

    uint256 private chainId;
    uint256 public maxTokenIndex;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId,
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
        maxTokenIndex = _maxTokenIndex;
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }

    function isHub(uint256 tokenId) public view override returns (bool) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        return tokenIndex < maxTokenIndex;
    }

    function isConfirmableMint(uint256 tokenId) public view override returns (bool) {
        // A mint is confirmable if the index has not yet been minted
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        return !initialMintComplete[tokenIndex];
    }

    function _afterTokenTransfer(address, address, uint256 tokenId, uint256) internal override {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        initialMintComplete[tokenIndex] = true;
    }

    function mint(
        address to,
        uint256 tokenId
    )
        public
        override
    {
        super.mint(to, tokenId);
    }
}