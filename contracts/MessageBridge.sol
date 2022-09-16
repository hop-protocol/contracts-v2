//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";
import "./libraries/Error.sol";
import "./MessageForwarder.sol";
import "hardhat/console.sol"; // ToDo: Remove

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

struct Message {
    address from;
    address to;
    uint256 value;
    bytes message;
}

struct ConfirmedBundle {
    uint256 fromChainId;
    bytes32 bundleRoot;
    uint256 bundleValue;
}

abstract contract MessageBridge {
    using Lib_MerkleTree for bytes32;

    MessageForwarder public messageForwarder;
    // address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    // address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    mapping(bytes32 => ConfirmedBundle) bundles;
    mapping(bytes32 => bool) relayedMessage;

    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata message,
        uint256 value
    ) external virtual payable;

    function relayMessage(
        address from,
        address to,
        bytes calldata message,
        uint256 value,
        bytes32 bundleId,
        uint256 treeIndex,
        bytes32[] calldata siblings,
        uint256 totalLeaves
    )
        external
    {
        ConfirmedBundle memory bundle = bundles[bundleId];
        bytes32 messageId;
        {
            messageId = getMessageId(from, to, value, message);
        }
        if (bundle.bundleRoot == bytes32(0)) {
            revert BundleNotFound(bundleId, messageId);
        }

        bool isProofValid = bundle.bundleRoot.verify(
            messageId,
            treeIndex,
            siblings,
            totalLeaves
        );

        if (!isProofValid) {
            revert InvalidProof(bundle.bundleRoot, messageId, treeIndex, siblings, totalLeaves);
        }

        relayedMessage[messageId] = true;

        // ToDo: Add value
        bool success = messageForwarder.forward(from, to, message);

        if (success == false) {
            relayedMessage[messageId] = false;
        }
    }

    function setMessageForwarder(MessageForwarder _messageForwarder) external {
        // ToDo: onlyOwner
        messageForwarder = _messageForwarder;
    }

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }

    function getMessageId(
        address from,
        address to,
        uint256 value,
        bytes memory message
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(from, to, value, message));
    }
}
