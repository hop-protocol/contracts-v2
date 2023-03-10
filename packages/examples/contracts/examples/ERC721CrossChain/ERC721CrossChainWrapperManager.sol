// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../libraries/token/ERC721CrossChain/ERC721CrossChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ERC721CrossChainWrapperManager is ERC721CrossChain, Ownable, IERC721Receiver {

    IERC721 private immutable _underlying;
    mapping(uint256 => uint256) private _burnNonce;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        IERC721 underlyingToken
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        _underlying = underlyingToken;
    }

    function deposit(uint256 tokenId, uint256 serialNumber) public virtual returns (bool) {
        underlying().safeTransferFrom(_msgSender(), address(this), tokenId);

        uint256 crossChainSerialNumber = getCrossChainSerialNumber(tokenId, serialNumber);
        _mintWrapperAndConfirm(crossChainSerialNumber, 0);

        return true;
    }


    /**
     * @notice This leaves the burned crossChainSerialNumber in a confirmed state. That crossChainSerialNumber can never be re-minted, so this is not a concern.
     */
    function withdraw(uint256 tokenId, uint256 serialNumber) public virtual returns (bool) {
        uint256 crossChainSerialNumber = getCrossChainSerialNumber(tokenId, serialNumber);
        require(_isApprovedOrOwner(_msgSender(), crossChainSerialNumber), "ERC721CrossChainWrapperManager: caller is not token owner or approved");

        _burn(crossChainSerialNumber);
        _burnNonce[crossChainSerialNumber]++;

        underlying().safeTransferFrom(address(this), _msgSender(), tokenId);

        return true;
    }

    function getCrossChainSerialNumber(uint256 tokenId, uint256 serialNumber) public view virtual returns (uint256) {
        return uint256(keccak256(abi.encodePacked(tokenId, serialNumber, address(underlying()), _burnNonce[tokenId])));
    }

    /**
     * @notice Tokens cannot be sent directly to this contract since minting and burning requires a tokenId and serialNumber.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        require(false, "ERC721CrossChainWrapperManager: Not supported");
    }

    function underlying() public view virtual returns (IERC721) {
        return _underlying;
    }

    function burnNonce(uint256 crossChainSerialNumber) public view virtual returns (uint256) {
        return _burnNonce[crossChainSerialNumber];
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public onlyOwner {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainWrapperManager: Length must match");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}
