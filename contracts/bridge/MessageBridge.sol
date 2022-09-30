//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../utils/Lib_MerkleTree.sol";
import "../libraries/Error.sol";
import "../libraries/Message.sol";
import "../interfaces/ICrossChainSource.sol";
import "../interfaces/ICrossChainDestination.sol";

import "hardhat/console.sol"; // ToDo: Remove

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 root,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

struct ConfirmedBundle {
    uint256 fromChainId;
    bytes32 root;
}

struct BundleProof {
    bytes32 bundleId;
    uint256 treeIndex;
    bytes32[] siblings;
    uint256 totalLeaves;
}

abstract contract MessageBridge is Ownable, ICrossChainSource, ICrossChainDestination {
    using Lib_MerkleTree for bytes32;
    using MessageLibrary for Message;

    /* constants */
    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;
    uint256 private constant DEFAULT_XDOMAIN_CHAINID = uint256(bytes32(keccak256("Default Hop xDomain Sender")));
    uint256 private xDomainChainId = DEFAULT_XDOMAIN_CHAINID;

    /* state */
    mapping(bytes32 => ConfirmedBundle) public bundles;
    mapping(bytes32 => bool) public relayedMessage;

    function relayMessage(
        uint256 nonce,
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        BundleProof memory bundleProof
    )
        external
    {
        Message memory message = Message(
            nonce,
            fromChainId,
            from,
            getChainId(),
            to,
            data
        );
        bytes32 messageId = message.getMessageId();

        validateProof(bundleProof, messageId);

        relayedMessage[messageId] = true;

        bool success = _relayMessage(messageId, message.fromChainId, message.from, message.to, message.data);

        if (!success) {
            relayedMessage[messageId] = false;
        }
    }

    function validateProof(BundleProof memory bundleProof, bytes32 messageId) public view {
        ConfirmedBundle memory bundle = bundles[bundleProof.bundleId];

        if (bundle.root == bytes32(0)) {
            revert BundleNotFound(bundleProof.bundleId, messageId);
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

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
