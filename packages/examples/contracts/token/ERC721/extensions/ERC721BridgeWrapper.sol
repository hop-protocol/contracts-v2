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
            _messengerAddress,
            0
        )
    {
        _underlying = _underlyingToken;
        _confirmableTokenId = _DEFAULT_TOKEN_ID;
    }

    function isHub(uint256) public view override returns (bool) {
        return address(underlying()) == address(this);
    }

    function isConfirmableMint(uint256 tokenId) public view override returns (bool) {
        return tokenId == _confirmableTokenId;
    }

    function depositForAndSend(
        uint256 toChainId,
        address to,
        uint256 tokenId
    )
        public
    {
        depositFor(to, tokenId);
        send(toChainId, to, tokenId);
    }

    function mintAndWithdrawTo(
        address to,
        uint256 tokenId
    )
        public
    {


        mint(to, tokenId);
        withdrawTo(to, tokenId);
    }


    function depositFor(address to, uint256 tokenId) public returns (bool) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);

        // This is an "unsafe" transfer that doesn't call any hook on the receiver. With underlying() being trusted
        // (by design of this contract) and no other contracts expected to be called from there, we are safe.
        // slither-disable-next-line reentrancy-no-eth
        underlying().transferFrom(_msgSender(), address(this), tokenIndex);


        // Replace with transient storage when available on all chains
        _confirmableTokenId = tokenId;
        mint(to, tokenId);
        _confirmableTokenId = _DEFAULT_TOKEN_ID;

        return true;
    }

    function withdrawTo(address to, uint256 tokenId) public returns (bool) {
        (, uint256 tokenIndex) = decodeTokenId(tokenId);
        TokenStatus storage tokenStatus = tokenStatuses[tokenId];
        if (!tokenStatus.confirmed) revert NotConfirmed(tokenId);

        // Checks were already performed at this point, and there's no way to retake ownership or approval from
        // the wrapped tokenId after this point, so it's safe to remove the reentrancy check for the next line.
        // slither-disable-next-line reentrancy-no-eth
        underlying().safeTransferFrom(address(this), to, tokenIndex);

        burn(tokenId);

        // Withdrawing the underlying will always represent the canonical token, so this value can be reset so that
        // the token can be burned
        tokenStatus.confirmed = false;

        return true;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        // NOTE: Consider using OZ logic here to mint the token. It would be convenient, but would require encoding of
        // the sender and the index, which the contract is currently unconcerned with. If this design decision changes,
        // update this function to reflect that.
        // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/extensions/ERC721Wrapper.sol#L59-L78
        return IERC721Receiver.onERC721Received.selector;
    }

    function underlying() public view virtual returns (IERC721) {
        return _underlying;
    }

    function _afterTokenMint(uint256 tokenId) internal override {
        // There is no action needed after a token mint with this extension.
    }
}