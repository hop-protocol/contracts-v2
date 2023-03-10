// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC721CrossChainWrapperManagerGeneralized.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ERC721CrossChainWrapperManager is ERC721CrossChainWrapperManagerGeneralized {

    IERC721 private immutable _underlying;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        IERC721 underlyingToken
    )
        ERC721CrossChainWrapperManagerGeneralized(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        _underlying = underlyingToken;
    }

    function deposit(uint256 tokenId, uint256 serialNumber) public virtual returns (bool) {
        return super.deposit(tokenId, serialNumber, underlying());
    }

    function withdraw(uint256 tokenId, uint256 serialNumber) public virtual returns (bool) {
        return super.withdraw(tokenId, serialNumber, underlying());
    }

    function underlying() public view virtual returns (IERC721) {
        return _underlying;
    }
}
