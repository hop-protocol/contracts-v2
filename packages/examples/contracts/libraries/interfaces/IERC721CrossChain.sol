// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC721CrossChain is IERC165 {
    struct TokenData {
        uint256 serialNumber;
        uint256 toChainId;
        address to;
        bool confirmed;
        bool spent;
    }

    event SupportedChainAdded(uint256 indexed chainId);
    event TargetAddressSet(uint256 indexed chainId, address indexed targetAddress);
    event WrapperMinted(
        uint256 indexed tokenId,
        uint256 indexed serialNumber,
        uint256 indexed previousTokenId,
        address minter
    );
    // serialNumber is not indexed since it can be looked up from WrapperMinted, which must have already been called
    event WrapperSent(
        uint256 indexed tokenId,
        uint256 indexed toChainId,
        uint256 indexed nextTokenId,
        address to,
        uint256 serialNumber
    );
    event WrapperConfirmed(uint256 indexed tokenId);
    event ConfirmationSentCrossChain(uint256 indexed tokenId, uint256 indexed toChainId);

    function messengerAddress() external view returns (address);

    function mintWrapper(uint256 serialNumber, uint256 previousTokenId ) external returns (uint256);
    function send(uint256 tokenId, uint256 toChainId, address to ) external payable;
    function confirm(uint256 tokenId) external payable;

    function getChainId() external view returns (uint256);
    function getIsChainIdSupported(uint256 chainId) external view returns (bool);
    function getCrossChain721AddressByChainId(uint256 chainId) external view returns (address);
    function getTokenId(uint256 chainId, address minter, uint256 serialNumber, uint256 previousTokenId) external pure returns (uint256);
    function getTokenData(uint256 tokenId) external view returns (TokenData memory);
}