//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";

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
    address to;
    bytes message;
    uint256 value;
}

struct PendingBundle {
    bytes32[] messageIds;
    uint256 value;
    uint256 fees;
}

struct ConfirmedBundle {
    bytes32 bundleRoot;
    uint256 bundleValue;
    uint256 fromChainId;
}

library Lib_PendingBundle {
    using Lib_MerkleTree for bytes32;

    function getBundleRoot(PendingBundle storage pendingBundle) internal view returns (bytes32) {
        return Lib_MerkleTree.getMerkleRoot(pendingBundle.messageIds);
    }
}

abstract contract MessageBridge {
    using Lib_MerkleTree for bytes32;
    using Lib_PendingBundle for PendingBundle;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    mapping(bytes32 => ConfirmedBundle) bundles;
    mapping(bytes32 => bool) relayedMessage;

    function relayMessage(
        address from,
        address to,
        uint256 value,
        bytes calldata message,
        bytes32 bundleId,
        uint256 treeIndex,
        bytes32[] calldata siblings,
        uint256 totalLeaves
    )
        external
    {
        ConfirmedBundle memory bundle = bundles[bundleId];
        require(bundle.bundleRoot != bytes32(0), "MSG_BRG: Bundle not found");
        bytes32 messageId = getMessageId(from, to, value, message);
        require(
            bundle.bundleRoot.verify(
                messageId,
                treeIndex,
                siblings,
                totalLeaves
            ),
            "MSG_BRG: Invalid proof"
        );

        relayedMessage[messageId] = true;

        xDomainSender = from;
        (bool success, ) = to.call{value: value}(message);
        xDomainSender = DEFAULT_XDOMAIN_SENDER;

        if (success == false) {
            relayedMessage[messageId] = false;
        }
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

    function xDomainMessageSender() public view returns (address) {
        require(
            xDomainSender != DEFAULT_XDOMAIN_SENDER,
            "MSG_BRG: xDomainMessageSender is not set"
        );
        return xDomainSender;
    }
}
