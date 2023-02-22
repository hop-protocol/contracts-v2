// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../interfaces/IERC5164.sol";
import "../../interfaces/IERC721Bridge.sol";
import "./libraries/Error.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

abstract contract ERC721Bridge is IERC721Bridge, ERC721 {

    struct TokenForwardData {
        uint256 toChainId;
        uint256 tokenId;
    }

    struct TokenStatus {
        bool confirmed;
        uint256 tokenForwardedCount;
        TokenForwardData[] tokenForwardDatas;
    }

    /* events */
    // TODO: The newTokenId might need to be indexed since that is used for the confirmations
    // TODO: Should forward count be emitted? Might make for easier off-chain tracking. Can also be inferred.
    // TODO: Should the contract track confirmation count? Would make off-chain tracking easier at the expense of gas
    event TokenSent(
        uint256 indexed toChainId,
        address indexed to,
        uint256 indexed tokenId,
        uint256 newTokenId
    );
    // TODO: Should there be a difference between TokenConfirmed on mint and TokenConfirmed on cross-chain send?
    event TokenConfirmed(uint256 tokenId);
    event ConfirmationSent(
        uint256 indexed toChainId,
        uint256 indexed tokenId
    );

    /* constants */
    address public immutable messengerAddress;
    uint256 public immutable maxTokenIndex;

    /* config */
    mapping (uint256 => bool) public supportedChainIds;

    /* state */
    mapping (uint256 => TokenStatus) public tokenStatuses;
    mapping (uint256 => bool) public initialMintOnHubComplete;

    modifier noEmptyTokenIds(uint256[] memory tokenIds) {
        if (tokenIds.length == 0) revert NoEmptyTokenIds();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        uint256 _maxTokenIndex

    )
        ERC721(_name, _symbol)
    {
        if (_maxTokenIndex > type(uint96).max) revert TokenIndexTooLarge(_maxTokenIndex);
        messengerAddress = _messengerAddress;
        maxTokenIndex = _maxTokenIndex;

        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            uint256 chainId = _supportedChainIds[i];
            if (chainId == 0) revert NoZeroChainId();
            if (chainId == getChainId()) revert InvalidChainId(chainId);
            supportedChainIds[chainId] = true;
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC721Bridge).interfaceId || super.supportsInterface(interfaceId);
    }

    function mint(
        address to,
        uint256 tokenId
    )
        public
        virtual
    {
        if (!canMint(to, tokenId)) revert CannotMint(to, tokenId);

        // The confirmation check needs to be done before the mint so that an extension can override
        // the _afterTokenMint hook and update state based on their implementation
        if (shouldConfirmMint(tokenId)) {
            tokenStatuses[tokenId].confirmed = true;
            emit TokenConfirmed(tokenId);
        }

        _safeMint(to, tokenId);
        _afterTokenMint(tokenId);
    }

    function burn(
        uint256 tokenId
    )
        public
        virtual
    {
        if (!canBurn(tokenId)) revert CannotBurn(tokenId);
        _burn(tokenId);
    }

    function send(
        uint256 toChainId,
        address to,
        uint256 tokenId
    )
        public
        virtual
    {
        if (!supportedChainIds[toChainId]) revert UnsupportedChainId(toChainId);

        burn(tokenId);

        uint256 newTokenId = encodeTokenId(to, tokenId);
        TokenStatus storage tokenStatus = tokenStatuses[tokenId];
        if (tokenStatus.confirmed) {
            tokenStatus.confirmed = false;
            _sendConfirmationCrossChain(toChainId, newTokenId);
        } else {
            tokenStatus.tokenForwardDatas.push(TokenForwardData(toChainId, newTokenId));
        }
        emit TokenSent(toChainId, to, tokenId, newTokenId);
    }


    function confirm(uint256 tokenId) external {

        // Only forward confirmation if the token has been sent to another chain
        TokenStatus storage tokenStatus = tokenStatuses[tokenId];
        if (tokenStatus.tokenForwardDatas.length != tokenStatus.tokenForwardedCount){
            TokenForwardData memory tokenForwardDatas = tokenStatus.tokenForwardDatas[tokenStatus.tokenForwardedCount];
            _sendConfirmationCrossChain(tokenForwardDatas.toChainId, tokenForwardDatas.tokenId);
            unchecked { ++tokenStatus.tokenForwardedCount; }
        } else {
            tokenStatus.confirmed = true;
        }

        // Even though the confirmed flag is not set in some cases, the token is still considered confirmed, even if instantaneously
        emit TokenConfirmed(tokenId);
    }

    function encodeTokenId(address to, uint256 tokenId) public pure returns (uint256) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        if (tokenIndex > type(uint96).max) revert TokenIndexTooLarge(tokenIndex);
        return uint256(bytes32(abi.encodePacked(to, uint96(tokenIndex))));
    }

    function decodeTokenId(uint256 tokenId) public pure returns (address, uint256) {
        address owner = address(uint160(tokenId >> 96));
        uint256 tokenIndex = tokenId & 0xffffffffffffffffffffffff;
        return (owner, tokenIndex);
    }

    function canMint(address to, uint256 tokenId) public pure returns (bool) {
        (address owner,) = decodeTokenId(tokenId);
        return owner == to;
    }

    function canBurn(uint256 tokenId) public view returns (bool) {
        // A confirmed token represents the canonical token and cannot be burnt without being sent to another chain
        bool isConfirmed = tokenStatuses[tokenId].confirmed;
        // From ERC721Burnable
        bool isApprovedOrOwner = _isApprovedOrOwner(_msgSender(), tokenId);

        return !isConfirmed || isApprovedOrOwner;
    }

    function shouldConfirmMint(uint256 tokenId) public view returns (bool) {
        return isHub(tokenId) && isConfirmableMint(tokenId);
    }

    function isHub(uint256 tokenId) public view virtual returns (bool) {
        // TODO: Verify that this is valid in all cases
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        bool isSpoke = maxTokenIndex == 0;
        bool isTokenOnHub = tokenIndex <= maxTokenIndex;
        return !isSpoke && isTokenOnHub;
    }

    function isConfirmableMint(uint256 tokenId) public view virtual returns (bool) {
        // A mint is confirmable if the index has not yet been minted
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        return !initialMintOnHubComplete[tokenIndex];
    }


    function sendMany(
        uint256 toChainId,
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
        noEmptyTokenIds(tokenIds)
    {
        if (tokenIds.length == 0) revert NoEmptyTokenIds();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            send(toChainId, to, tokenIds[i]);
        }
    }

    function mintMany(
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
        noEmptyTokenIds(tokenIds)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            mint(to, tokenIds[i]);
        }
    }

    function burnMany(
        uint256[] calldata tokenIds
    )
        public
        virtual
        noEmptyTokenIds(tokenIds)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            burn(tokenIds[i]);
        }
    }

    function mintAndSendMany(
        uint256 toChainId,
        address to,
        uint256[] calldata tokenIds
    )
        public
        virtual
        noEmptyTokenIds(tokenIds)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            mint(to, tokenIds[i]);
            send(toChainId, to, tokenIds[i]);
        }
    }

    // Getters

    function getChainId() public view virtual returns (uint256) {
        return block.chainid;
    }

    // Internal Functions

    function _sendConfirmationCrossChain(uint256 toChainId, uint256 tokenId) internal {
        bytes memory data = abi.encodeWithSelector(this.confirm.selector, tokenId);
        IERC5164(messengerAddress).dispatchMessage(toChainId, address(this), data);
        emit ConfirmationSent(toChainId, tokenId);
    }

    function _afterTokenMint(uint256 tokenId) internal virtual {
        // Initial mint is not a concern for spoke chains
        if (!isHub(tokenId)) return;

        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        if (initialMintOnHubComplete[tokenIndex]) return;

        initialMintOnHubComplete[tokenIndex] = true;
    }
}