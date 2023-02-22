// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721/ERC721Bridge.sol";

contract ERC721BridgeMock is ERC721Bridge {

    uint256 private chainId;

    // TODO: Add note that the token indexes cannot exceed uint96 but should still be uint256 to respect the standard
    // TODO: Add a note that if both are 0 then it represents a spoke chain
    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _maxTokenIndex,
        uint256 _chainId
    )
        ERC721Bridge(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _maxTokenIndex
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }
}