// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721/ERC721CrossChain.sol";

contract ERC721CrossChainMock is ERC721CrossChain {

    uint256 private chainId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _chainId
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        chainId = _chainId;
    }

    function getChainId() public view override returns (uint256) {
        return chainId;
    }

    function mintWrapperAndConfirm(uint256 serialNumber) public {
        _mintWrapperAndConfirm(serialNumber, 0);
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainMock: chainIds and targetAddresses must be the same length");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}