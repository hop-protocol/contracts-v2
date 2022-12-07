//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../utils/Lib_MerkleTree.sol";
import "../libraries/Error.sol";
import "../libraries/Bitmap.sol";
import "../interfaces/ICrossChainSource.sol";
import "../interfaces/ICrossChainDestination.sol";

import "hardhat/console.sol"; // ToDo: Remove

struct ConfirmedBundle {
    bytes32 root;
    uint256 fromChainId;
}

struct BundleProof {
    bytes32 bundleId;
    uint256 treeIndex;
    bytes32[] siblings;
    uint256 totalLeaves;
}

abstract contract MessageBridge is Ownable, EIP712, ICrossChainSource, ICrossChainDestination {
    using Lib_MerkleTree for bytes32;
    using BitmapLibrary for Bitmap;

    event BundleSet(bytes32 indexed bundleId, bytes32 bundleRoot, uint256 indexed fromChainId);

    /* constants */
    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    uint256 private constant DEFAULT_XDOMAIN_CHAINID = uint256(bytes32(keccak256("Default Hop xDomain Sender")));
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;
    uint256 private xDomainChainId = DEFAULT_XDOMAIN_CHAINID;

    /* state */
    mapping(address => bool) public noMessageList;
    mapping(bytes32 => ConfirmedBundle) public bundles;
    mapping(bytes32 => Bitmap) private spentMessagesForBundleId;

    constructor() EIP712("MessageBridge", "1") {}

    function relayMessage(
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        BundleProof memory bundleProof
    )
        external
    {
        bytes32 messageId = getSpokeMessageId(
            bundleProof.bundleId,
            bundleProof.treeIndex,
            fromChainId,
            from,
            getChainId(),
            to,
            data
        );

        validateProof(bundleProof, messageId);
        Bitmap storage spentMessages = spentMessagesForBundleId[bundleProof.bundleId];
        spentMessages.switchTrue(bundleProof.treeIndex); // Reverts if already true

        bool success = _relayMessage(messageId, fromChainId, from, to, data); // ToDo: Inlining this saves 434 gas, any solution?

        if (!success) {
            spentMessages.switchFalse(bundleProof.treeIndex);
        }
    }

    function _setBundle(bytes32 bundleId, bytes32 bundleRoot, uint256 fromChainId) internal {
        bundles[bundleId] = ConfirmedBundle(bundleRoot, fromChainId);
        emit BundleSet(bundleId, bundleRoot, fromChainId);
    }

    function _setTrue(Bitmap storage bitmap, uint256 chunkIndex, bytes32 bitmapChunk, uint256 bitOffset) private {
        bitmap._bitmap[chunkIndex] = (bitmapChunk | bytes32(1 << bitOffset));
    }

    function _isTrue(bytes32 bitmapChunk, uint256 bitOffset) private pure returns (bool) {
        return ((bitmapChunk >> bitOffset) & bytes32(uint256(1))) != bytes32(0);
    }

    function validateProof(BundleProof memory bundleProof, bytes32 messageId) public view {
        ConfirmedBundle memory bundle = bundles[bundleProof.bundleId];

        if (bundle.root == bytes32(0)) {
            revert BundleNotFound(bundleProof.bundleId);
        }

        bool isProofValid = bundle.root.verify(
            messageId,
            bundleProof.treeIndex,
            bundleProof.siblings,
            bundleProof.totalLeaves
        );

        if (!isProofValid) {
            revert InvalidProof(
                bundle.root,
                messageId,
                bundleProof.treeIndex,
                bundleProof.siblings,
                bundleProof.totalLeaves
            );
        }
    }

    function _relayMessage(bytes32 messageId, uint256 fromChainId, address from, address to, bytes memory data) internal returns (bool success) {
        if (noMessageList[to]) revert CannotMessageAddress(to);

        xDomainSender = from;
        xDomainChainId = fromChainId;
        (success, ) = to.call(data);
        xDomainSender = DEFAULT_XDOMAIN_SENDER;
        xDomainChainId = DEFAULT_XDOMAIN_CHAINID;

        if (success) {
            emit MessageRelayed(messageId, fromChainId, from, to);
        } else {
            emit MessageReverted(messageId, fromChainId, from, to);
        }
    }

    function getXDomainChainId() public view returns (uint256) {
        if (xDomainChainId == DEFAULT_XDOMAIN_CHAINID) {
            revert NotCrossDomainMessage();
        }
        return xDomainChainId;
    }

    function getXDomainSender() public view returns (address) {
        if (xDomainSender == DEFAULT_XDOMAIN_SENDER) {
            revert NotCrossDomainMessage();
        }
        return xDomainSender;
    }

    function getXDomainData() public view returns (uint256, address) {
        return (getXDomainChainId(), getXDomainSender());
    }

    function getSpokeMessageId(
        bytes32 bundleId,
        uint256 treeIndex,
        uint256 fromChainId,
        address from,
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                bundleId,
                treeIndex,
                fromChainId,
                from,
                toChainId,
                to,
                data
            )
        );
    }

    function isMessageSpent(bytes32 bundleId, uint256 index) public view returns (bool) {
        Bitmap storage spentMessages = spentMessagesForBundleId[bundleId];
        return spentMessages.isTrue(index);
    }

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
