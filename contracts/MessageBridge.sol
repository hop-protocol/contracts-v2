//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";
import "./libraries/Error.sol";
import "./libraries/Message.sol";
import "./MessageForwarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol"; // ToDo: Remove

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleFees,
        uint256 fromChainId,
        uint256 toChainId,
        uint256 commitTime
    ) external payable;
}

struct ConfirmedBundle {
    uint256 fromChainId;
    bytes32 bundleRoot;
}

abstract contract MessageBridge is Ownable {
    using Lib_MerkleTree for bytes32;
    using MessageLibrary for Message;

    /* constants */
    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    /* state */
    mapping(bytes32 => ConfirmedBundle) bundles;
    mapping(bytes32 => bool) relayedMessage;

    function sendMessage(
        uint256 toChainId,
        address to,
        bytes calldata message
    ) external virtual payable;

    function relayMessage(
        Message memory message,
        bytes32 bundleId,
        uint256 treeIndex,
        bytes32[] calldata siblings,
        uint256 totalLeaves
    )
        external
    {
        ConfirmedBundle memory bundle = bundles[bundleId];
        bytes32 messageId = message.getMessageId();
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

        bool success = _relayMessage(message.from, message.to, message.data);

        if (success == false) {
            relayedMessage[messageId] = false;
        }
    }

    function _relayMessage(address from, address to, bytes memory data) internal returns (bool success) {
        xDomainSender = from;
        (success, ) = to.call(data);
        xDomainSender = DEFAULT_XDOMAIN_SENDER;
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
