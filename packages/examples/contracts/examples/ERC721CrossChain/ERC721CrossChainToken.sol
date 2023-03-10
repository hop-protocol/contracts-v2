// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../libraries/token/ERC721CrossChain/ERC721CrossChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ERC721CrossChainToken is ERC721CrossChain, Ownable {

    uint256 public currentTokenCount;
    uint256 public maxTokenCount;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _maxTokenCount
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        maxTokenCount = _maxTokenCount;
    }

    function mint(uint256 count) public onlyOwner {
        for (uint256 i = 0; i < count; i++) {
            require(currentTokenCount <= maxTokenCount, "ERC721CrossChainToken: Max token count exceeded");
            currentTokenCount++;
            _mintWrapperAndConfirm(currentTokenCount, 0);
        }
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public onlyOwner {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainToken: Length must match");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}