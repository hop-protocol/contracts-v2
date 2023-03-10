// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../libraries/token/ERC721/ERC721CrossChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721CrossChainTokenSale is ERC721CrossChain, Ownable {

    uint256 public currentTokenCount;
    uint256 public maxTokenCount;
    uint256 public price;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _maxTokenCount,
        uint256 _price
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        maxTokenCount = _maxTokenCount;
        price = _price;
    }

    function mint() public payable {
        require(msg.value == price, "ERC721CrossChainTokenSale: Must send the correct amount");
        require(currentTokenCount <= maxTokenCount, "ERC721CrossChainTokenSale: Max token count exceeded");

        payable(owner()).transfer(msg.value);
        currentTokenCount++;

        _mintWrapperAndConfirm(currentTokenCount, 0);
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public onlyOwner {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainTokenSale: Length must match");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}