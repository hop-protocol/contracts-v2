// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../libraries/token/ERC721CrossChain/ERC721CrossChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ERC721CrossChainWrapperManagerGeneralized is ERC721CrossChain, Ownable, IERC721Receiver {

    mapping(uint256 => uint256) private _nonce;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {}

    function deposit(uint256 tokenId, uint256 serialNumber, IERC721 underlyingToken) public virtual returns (bool) {
        underlyingToken.safeTransferFrom(_msgSender(), address(this), tokenId);

        uint256 crossChainSerialNumber = getCrossChainSerialNumber(tokenId, serialNumber, address(underlyingToken), _nonce[tokenId]);
        _mintWrapperAndConfirm(crossChainSerialNumber, 0);

        return true;
    }


    /**
     * @notice This leaves the burned crossChainSerialNumber in a confirmed state. That crossChainSerialNumber can never be re-minted, so this is not a concern.
     */
    function withdraw(uint256 tokenId, uint256 serialNumber, IERC721 underlyingToken) public virtual returns (bool) {
        uint256 crossChainSerialNumber = getCrossChainSerialNumber(tokenId, serialNumber, address(underlyingToken), _nonce[tokenId]);
        require(_isApprovedOrOwner(_msgSender(), crossChainSerialNumber), "ERC721CrossChainWrapperManagerGeneralized: caller is not token owner or approved");

        _nonce[crossChainSerialNumber]++;
        _burn(crossChainSerialNumber);

        underlyingToken.safeTransferFrom(address(this), _msgSender(), tokenId);

        return true;
    }

    function getCrossChainSerialNumber(uint256 tokenId, uint256 serialNumber, address underlyingTokenAddress, uint256 serialNumberNonce) public view virtual returns (uint256) {
        return uint256(keccak256(abi.encodePacked(tokenId, serialNumber, underlyingTokenAddress, serialNumberNonce)));
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
        require(false, "ERC721CrossChainWrapperManagerGeneralized: Not supported");
    }

    function nonce(uint256 crossChainSerialNumber) public view virtual returns (uint256) {
        return _nonce[crossChainSerialNumber];
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public onlyOwner {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainWrapperManagerGeneralized: Length must match");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}
