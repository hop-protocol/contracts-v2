// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../ERC721CrossChain/ERC721CrossChainTokenSale.sol";

contract ERC721CrossChainTokenSaleMock is ERC721CrossChainTokenSale {

    uint256 private chainId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId,
        uint256 _maxTokenCount,
        uint256 _price
    )
        ERC721CrossChainTokenSale(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _maxTokenCount,
            _price
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }
}