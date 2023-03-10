// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../ERC721CrossChain/ERC721CrossChainWrapperManager.sol";

contract ERC721CrossChainWrapperManagerMock is ERC721CrossChainWrapperManager {

    uint256 private chainId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId,
        IERC721 _underlyingToken
    )
        ERC721CrossChainWrapperManager(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _underlyingToken
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }
}