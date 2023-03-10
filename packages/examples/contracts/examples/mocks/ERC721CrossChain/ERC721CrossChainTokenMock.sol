// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../ERC721CrossChain/ERC721CrossChainToken.sol";

contract ERC721CrossChainTokenMock is ERC721CrossChainToken {

    uint256 private chainId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId,
        uint256 _maxTokenCount
    )
        ERC721CrossChainToken(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _maxTokenCount
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }
}