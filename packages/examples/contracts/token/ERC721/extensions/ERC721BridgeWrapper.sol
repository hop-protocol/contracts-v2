// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./../ERC721Bridge.sol";

abstract contract ERC721BridgeWrapper is ERC721Bridge, IERC721Receiver {

    IERC721 public immutable _underlying;

    // Replace with transient storage when available on all chains
    uint256 private constant _DEFAULT_TOKEN_ID = uint256(keccak256(abi.encode("ERC721BridgeWrapper")));
    uint256 private _confirmableTokenId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        IERC721 _underlyingToken

    )
        ERC721Bridge(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        _underlying = _underlyingToken;
        _confirmableTokenId = _DEFAULT_TOKEN_ID;
    }

    function isSpoke() public view virtual override returns (bool) {
        return address(underlying()) == address(0);
    }

    function isTokenIdConfirmable(uint256 tokenId) public view virtual override returns (bool) {
        return tokenId == _confirmableTokenId;
    }

    function depositForAndSend(
        uint256 toChainId,
        address account,
        uint256[] memory tokenIds
    )
        public
    {
        depositFor(account, tokenIds);
        sendBatch(toChainId, account, tokenIds);
    }

    function mintAndWithdrawTo(
        address account,
        uint256[] memory tokenIds
    )
        public
    {
        mintBatch(tokenIds);
        withdrawTo(account, tokenIds);
    }


    function depositFor(address account, uint256[] memory tokenIds) public returns (bool) {
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 tokenId = tokenIds[i];
            (, uint256 tokenIndex) = decodeTokenId(tokenId);

            underlying().safeTransferFrom(_msgSender(), address(this), tokenIndex);
            _mintWithConfirmationUpdate(account, tokenId);
        }
        return true;
    }

    function withdrawTo(address account, uint256[] memory tokenIds) public returns (bool) {
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 tokenId = tokenIds[i];
            (, uint256 tokenIndex) = decodeTokenId(tokenId);

            _burnWithConfirmationUpdate(tokenId);
            underlying().safeTransferFrom(address(this), account, tokenIndex);
        }
        return true;
    }

    function onERC721Received(
        address,
        address account,
        uint256 tokenIndex,
        bytes memory
    ) public virtual override returns (bytes4) {
        if(address(underlying()) != _msgSender()) revert CallerNotUnderlying(msg.sender);
        uint256 tokenId = encodeTokenIndex(account, tokenIndex);
        _mintWithConfirmationUpdate(account, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function underlying() public view virtual returns (IERC721) {
        return _underlying;
    }

    /* Internal */
    function _mintWithConfirmationUpdate(address to, uint256 tokenId) internal {
        // Replace with transient storage when available on all chains
        _confirmableTokenId = tokenId;
        mint(to, tokenId);
        _confirmableTokenId = _DEFAULT_TOKEN_ID;
    }

    function _burnWithConfirmationUpdate(uint256 tokenId) internal {
        bool isConfirmed = getIsTokenConfirmed(tokenId);
        if (!isConfirmed) revert NotConfirmed(tokenId);

        burn(tokenId);
        // Withdrawing the underlying will always represent the canonical token, so this value can be reset so that
        // the token can be burned
        setIsTokenConfirmed(tokenId, false);
    }

    function _afterTokenMint(uint256 tokenId) internal override {
        // There is no action needed after a token mint with this extension.
    }
}