// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../interfaces/IERC721CrossChain.sol";
import "./libraries/Error.sol";
import "@hop-protocol/ERC5164/contracts/ISingleMessageDispatcher.sol";
import "@hop-protocol/ERC5164/contracts/CrossChainEnabled.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

abstract contract ERC721CrossChain is CrossChainEnabled, ERC721, IERC721CrossChain {

    /* constants */
    address public immutable messengerAddress;

    /* config */
    mapping (uint256 => bool) private _supportedChainIds;
    mapping (uint256 => address) private _crossChain721AddressByChainId;

    /* state */
    mapping (uint256 => TokenData) private _tokenDatas;

    modifier onlyCrossChain() {
        (, uint256 fromChainId, address from) = _crossChainContext();
        if (msg.sender != messengerAddress) revert InvalidSender(msg.sender);
        if (from != _crossChain721AddressByChainId[fromChainId]) revert InvalidCrossChainSender(from);
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256[] memory supportedChainIds_,
        address _messengerAddress
    )
        ERC721(name_, symbol_)
    {
        messengerAddress = _messengerAddress;

        for (uint256 i = 0; i < supportedChainIds_.length; i++) {
            uint256 chainId = supportedChainIds_[i];
            if (chainId == 0) revert NoZeroChainId();
            if (chainId == getChainId()) revert InvalidChainId(chainId);
            _supportedChainIds[chainId] = true;
            emit SupportedChainAdded(chainId);
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, IERC165) returns (bool) {
        return interfaceId == type(IERC721CrossChain).interfaceId || super.supportsInterface(interfaceId);
    }

    function mintWrapper(
        uint256 serialNumber,
        uint256 previousTokenId
    )
        public
        virtual
        returns (uint256)
    {
        uint256 tokenId = getTokenId(
            getChainId(),
            msg.sender,
            serialNumber,
            previousTokenId
        );

        // Each tokenId is unique and can only be minted once. A token will always have a different ID
        // after being sent cross-chain since the tokenId is based on the previous token's ID
        TokenData storage tokenData = _tokenDatas[tokenId];
        bool canBeMinted = !_exists(tokenId) && tokenData.spent == false;
        if (!canBeMinted) revert TokenAlreadyMinted(tokenId);

        tokenData.serialNumber = serialNumber;

        _safeMint(msg.sender, tokenId);
        emit WrapperMinted(tokenId, serialNumber, previousTokenId, msg.sender);
        return tokenId;
    }

    function send(
        uint256 tokenId,
        uint256 toChainId,
        address to
    )
        public
        payable
        virtual
    {
        if (!_supportedChainIds[toChainId]) revert UnsupportedChainId(toChainId);
        // This implicitly ensures that there is an assigned serialNumber, even if it is 0
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);

        // Update state
        TokenData storage tokenData = _tokenDatas[tokenId];
        bool wasConfirmed = tokenData.confirmed;
        tokenData.toChainId = toChainId;
        tokenData.to = to;
        tokenData.confirmed = false;
        tokenData.spent = true;

        _burn(tokenId);

        // Forward data to next chain, if necessary
        uint256 nextTokenId = getTokenId(
            toChainId,
            to,
            tokenData.serialNumber,
            tokenId
        );

        if (wasConfirmed) {
            _sendConfirmationCrossChain(nextTokenId, toChainId);
        }

        emit WrapperSent(tokenId, toChainId, nextTokenId, to, tokenData.serialNumber);
    }

    function confirm(uint256 tokenId) external payable onlyCrossChain {
        TokenData storage tokenData = _tokenDatas[tokenId];
        if (!tokenData.spent) {
            tokenData.confirmed = true;
        } else {
            uint256 nextTokenId = getTokenId(
                tokenData.toChainId,
                tokenData.to,
                tokenData.serialNumber,
                tokenId
            );
            _sendConfirmationCrossChain(nextTokenId, tokenData.toChainId);
        }

        emit WrapperConfirmed(tokenId);
    }

    /* Getters */

    function getChainId() public view virtual returns (uint256) {
        return block.chainid;
    }

    function getTokenId(uint256 chainId, address minter, uint256 serialNumber, uint256 previousTokenId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(chainId, minter, serialNumber, previousTokenId)));
    }

    function getIsChainIdSupported(uint256 chainId) external view returns (bool) {
        return _supportedChainIds[chainId];
    }

    function getCrossChain721AddressByChainId(uint256 chainId) external view returns (address) {
        return _crossChain721AddressByChainId[chainId];
    }

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        return _tokenDatas[tokenId];
    }

    /* Internal */

    function _sendConfirmationCrossChain(uint256 tokenId, uint256 toChainId) internal {
        bytes memory data = abi.encodeWithSelector(this.confirm.selector, tokenId);
        address targetAddress = _crossChain721AddressByChainId[toChainId];
        ISingleMessageDispatcher(messengerAddress).dispatchMessage(toChainId, targetAddress, data);
        emit ConfirmationSentCrossChain(tokenId, toChainId);
    }

    /**
     * @dev Sets the target address for a given chain ID. This is used to send confirmations to the destination. This
     * should be called by an extension contract after contracts have been deployed to the target chains.
     */
    function _setCrossChain721AddressByChainId(
        uint256 chainId,
        address targetAddress
    )
        internal
    {
        if (_crossChain721AddressByChainId[chainId] != address(0)) revert TargetAddressAlreadySet(chainId);
        if (targetAddress == address(0)) revert NoZeroTargetAddress(targetAddress);

        _crossChain721AddressByChainId[chainId] = targetAddress;
        emit TargetAddressSet(chainId, targetAddress);
    }

    /**
     * @dev Mints a wrapper and confirms it. This should be called by an extension contract in order to mint a wrapper
     * that is the first in a chain.
     */
    function _mintWrapperAndConfirm(
        uint256 serialNumber,
        uint256 previousTokenId
    )
        internal
        returns (uint256)
    {
        uint256 tokenId = mintWrapper(serialNumber, previousTokenId);
        _tokenDatas[tokenId].confirmed = true;
        emit WrapperConfirmed(tokenId);

        return tokenId;
    }
}