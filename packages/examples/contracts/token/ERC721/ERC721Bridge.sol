// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../common/ERC5164/ISingleMessageDispatcher.sol";
import "../common/ERC5164/CrossChainEnabled.sol";
import "../../interfaces/IERC721Bridge.sol";
import "./libraries/Error.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

abstract contract ERC721Bridge is IERC721Bridge, ERC721, CrossChainEnabled {

    struct TokenData {
        uint256 serialNumber;
        uint256 toChainId;
        bool confirmed;
        bool spent;
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

    /* config */
    mapping (uint256 => bool) public supportedChainIds;
    mapping (uint256 => address) public targetAddressByChainId;

    /* state */
    mapping (uint256 => TokenData) private _tokenDatas;

    modifier noEmptyTokenIds(uint256[] memory tokenIds) {
        if (tokenIds.length == 0) revert NoEmptyTokenIds();
        _;
    }

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
            if (chainId == 0) revert NoZeroChainId();
            if (chainId == getChainId()) revert InvalidChainId(chainId);
            supportedChainIds[chainId] = true;
            targetAddressByChainId[chainId] = address(this);
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC721Bridge).interfaceId || super.supportsInterface(interfaceId);
    }

    function mintWrapper(
        uint256 previousTokenId,
        uint256 serialNumber
    )
        public
        virtual
        returns (uint256)
    {
        uint256 tokenId = getTokenId(
            getChainId(),
            msg.sender,
            previousTokenId,
            serialNumber
        );


        // The rest of a token's data is either default or already set
        _tokenDatas[tokenId].serialNumber = serialNumber;
        _safeMint(msg.sender, tokenId);
        return tokenId;
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


        TokenData storage tokenData = _tokenDatas[tokenId];
        uint256 newTokenId = getTokenId(
            toChainId,
            to,
            tokenId,
            tokenData.serialNumber
        );

        _sendConfirmationCrossChain(toChainId, newTokenId);


        tokenData.toChainId = toChainId;
        tokenData.confirmed = false;
        tokenData.spent = true;

        _burn(tokenId);

        emit TokenSent(toChainId, to, tokenId, newTokenId);
    }

    function confirm(uint256 tokenId) external {
        // Validate the cross-chain caller
        (, uint256 fromChainId, address from) = _crossChainContext();
        if (msg.sender != messengerAddress) revert InvalidSender(msg.sender);
        if (from != targetAddressByChainId[fromChainId]) revert InvalidCrossChainSender(from);

        // Only forward confirmation if the token has been sent to another chain
        TokenData storage tokenData = _tokenDatas[tokenId];
        if (!tokenData.spent) {
            _tokenDatas[tokenId].confirmed = true;
        } else {
            _sendConfirmationCrossChain(tokenData.toChainId, tokenId);
        }

        emit TokenConfirmed(tokenId);
    }

    /* Getters */

    function getChainId() public view virtual returns (uint256) {
        return block.chainid;
    }

    function getTokenId(uint256 chainId, address owner, uint256 previousTokenId, uint256 serialNumber) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(chainId, owner, previousTokenId, serialNumber)));
    }

    function getIsConfirmed(uint256 tokenId) public view returns (bool) {
        return _tokenDatas[tokenId].confirmed;
    }

    function getIsSpent(uint256 tokenId) public view returns (bool) {
        return _tokenDatas[tokenId].spent;
    }

    function getTokenData(uint256 tokenId) public view returns (TokenData memory) {
        return _tokenDatas[tokenId];
    }

    /* Internal */

    function _sendConfirmationCrossChain(uint256 toChainId, uint256 tokenId) internal {
        bytes memory data = abi.encodeWithSelector(this.confirm.selector, tokenId);
        address targetAddress = targetAddressByChainId[toChainId];
        ISingleMessageDispatcher(messengerAddress).dispatchMessage(toChainId, targetAddress, data);
        emit ConfirmationSent(toChainId, tokenId);
    }

    function _mintWrapperAndConfirm(
        uint256 previousTokenId,
        uint256 serialNumber
    )
        internal
        virtual
        returns (uint256)
    {
        uint256 tokenId = mintWrapper(previousTokenId, serialNumber);
         _tokenDatas[tokenId].confirmed = true;
    }
}