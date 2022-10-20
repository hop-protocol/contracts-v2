//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../utils/Lib_MerkleTree.sol";
import "../libraries/Error.sol";
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

    /* constants */
    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    uint256 private constant DEFAULT_XDOMAIN_CHAINID = uint256(bytes32(keccak256("Default Hop xDomain Sender")));
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;
    uint256 private xDomainChainId = DEFAULT_XDOMAIN_CHAINID;

    /* state */
    mapping(bytes32 => ConfirmedBundle) public bundles;
    mapping(bytes32 => bool) public relayedMessage;

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
        if (relayedMessage[messageId] == true) {
            revert MessageIsSpent(
                bundleProof.bundleId,
                bundleProof.treeIndex,
                messageId
            );
        }

        relayedMessage[messageId] = true; // ToDo: 15k gas saving for doing with with bitmap

        bool success = _relayMessage(messageId, fromChainId, from, to, data);

        if (!success) {
            relayedMessage[messageId] = false;
        }
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
        // ToDo: Add call blacklist

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
            revert XDomainChainIdNotSet();
        }
        return xDomainChainId;
    }

    function getXDomainSender() public view returns (address) {
        if (xDomainSender == DEFAULT_XDOMAIN_SENDER) {
            revert XDomainMessengerNotSet();
        }
        return xDomainSender;
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

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
