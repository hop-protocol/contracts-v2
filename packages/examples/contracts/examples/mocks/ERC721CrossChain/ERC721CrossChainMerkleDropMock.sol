// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../ERC721CrossChain/ERC721CrossChainMerkleDrop.sol";

contract ERC721CrossChainMerkleDropMock is ERC721CrossChainMerkleDrop {

    uint256 private chainId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId,
        bytes32 _merkleRoot
    )
        ERC721CrossChainMerkleDrop(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress,
            _merkleRoot
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }
}