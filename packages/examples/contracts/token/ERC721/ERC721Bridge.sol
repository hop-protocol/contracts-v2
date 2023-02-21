// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../interfaces/IERC5164.sol";
import "../../interfaces/IERC721Bridge.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

abstract contract ERC721Bridge is IERC721Bridge, ERC721 {

    address public messengerAddress;

    mapping (uint256 => bool) public canonicalTokenIndexMinted;
    mapping (uint256 => bool) public supportedChainIds;

    struct TokenStatus {
        bool confirmed;
        uint256 tokenForwardedCount;
        uint256[] toChainIds;
    }

    mapping (uint256 => TokenStatus) public tokenStatuses;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress

    )
        ERC721(_name, _symbol)
    {
        messengerAddress = _messengerAddress;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            uint256 chainId = _supportedChainIds[i];
            require(chainId != 0, "ERC721B: ChainId 0 is not supported");
            require(chainId != getChainId(), "ERC721B: Supported chainIds cannot include the current chainId");
            supportedChainIds[chainId] = true;
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC721Bridge).interfaceId || super.supportsInterface(interfaceId);
    }

    function send(
        uint256 toChainId,
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
    {
        require(tokenIds.length > 0, "ERC721B: Need at least one tokenId");
        require(supportedChainIds[toChainId], "ERC721B: Must send to a supported chain");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            TokenStatus storage tokenStatus = tokenStatuses[tokenId];
            if (tokenStatus.confirmed) {
                tokenStatus.confirmed = false;
                uint256 updatedTokenId = getUpdatedTokenId(to, tokenId);
                _sendConfirmationCrossChain(updatedTokenId, toChainId);
            } else {
                tokenStatus.toChainIds.push(toChainId);
            }

            emit Sent(to, tokenId, toChainId);
        }

        burn(tokenIds);
    }

    function confirm(uint256 tokenId) external {

        // Only forward confirmation if the token has been sent to another chain
        TokenStatus storage tokenStatus = tokenStatuses[tokenId];
        if (tokenStatus.toChainIds.length != tokenStatus.tokenForwardedCount){
            _sendConfirmationCrossChain(tokenId, tokenStatus.toChainIds[tokenStatus.tokenForwardedCount]);
            unchecked { ++tokenStatus.tokenForwardedCount; }
        } else {
            tokenStatus.confirmed = true;
        }

        // emit Confirmed(to, tokenId);
    }

    function mint(
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
    {
        require(tokenIds.length > 0, "ERC721B: Need at least one tokenId");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(canMint(to, tokenId), "ERC721B: Cannot mint token");

            _safeMint(to, tokenId);

            (, uint256 tokenIndex) = decodeTokenId(tokenId);
            if (isHub(tokenId) && !canonicalTokenIndexMinted[tokenIndex]) {
                tokenStatuses[tokenId].confirmed = true;
                canonicalTokenIndexMinted[tokenIndex] = true;
            }

            emit Minted(to, tokenId);
        }
    }

    function burn(
        uint256[] calldata tokenIds
    )
        public
        virtual
    {
        require(tokenIds.length > 0, "ERC721B: Need at least one tokenId");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(canBurn(tokenId), "ERC721B: Cannot burn token");

            // From ERC721Burnable
            require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721B: caller is not token owner or approved");
            _burn(tokenId);

            tokenStatuses[tokenId].tokenState = TokenState.Unminted;
        }
    }

    function mintAndSend(
        uint256 toChainId,
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
    {
        mint(to, tokenIds);
        send(toChainId, to, tokenIds);
    }

    function decodeTokenId(uint256 tokenId) public pure returns (address, uint96) {
        address owner = address(uint160(tokenId >> 96));
        uint256 tokenIndex = tokenId & 0xffffffffffffffffffffffff;
        return (owner, uint96(tokenIndex));
    }

    function canMint(address to, uint256 tokenId) public pure returns (bool) {
        (address owner,) = decodeTokenId(tokenId);
        return owner == to;
    }

    function canBurn(uint256 tokenId) public view returns (bool) {
        // A confirmed token represents the canonical token and cannot be burnt without being sent to another chain
        return !tokenStatuses[tokenId].confirmed;
    }

    function isHub(uint256) public view virtual returns (bool) {
        require(false, "ERC721B: isHub not implemented");
    }

    // Getters

    function getChainId() public view virtual returns (uint256) {
        return block.chainid;
    }

    function getUpdatedTokenId(address to, uint256 tokenId) public pure returns (uint256) {
        (, uint96 tokenIndex) = decodeTokenId(tokenId);
        return uint256(bytes32(abi.encodePacked(to, tokenIndex)));
    }

    // Internal Functions

    function _sendConfirmationCrossChain(uint256 tokenId, uint256 toChainId) internal {
        bytes memory data = abi.encodeWithSelector(this.confirm.selector, tokenId);
        IERC5164(messengerAddress).dispatchMessage(toChainId, address(this), data);
    }
}