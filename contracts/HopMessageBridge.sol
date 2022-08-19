//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./utils/Lib_MerkleTree.sol";

interface IHopMessageReceiver {
    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 destinationChainId
    ) external payable;
}

struct Message {
    address to;
    bytes message;
    uint256 value;
}

struct Bundle {
    bytes32 bundleRoot;
    uint256 bundleValue;
}

contract HopMessageBridge {
    using Lib_MerkleTree for bytes32;

    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;

    mapping(uint256 => IHopMessageReceiver) bridgeForChainId;
    // destination chain Id -> pending message Ids
    mapping(uint256 => bytes32[]) public pendingMessageIdsForChainId;
    mapping(uint256 => uint256) public pendingValue;
    mapping(uint256 => uint256) public pendingBundleRelayerReward;
    mapping(bytes32 => Bundle) bundles;
    mapping(bytes32 => bool) relayedMessage;

    function sendMessage(uint256 destinationChainId, address to, bytes calldata message) external payable {
        bytes32 messageId = getMessageId(msg.sender, to, msg.value, message);
        pendingMessageIdsForChainId[destinationChainId].push(messageId);
        pendingValue[destinationChainId] = pendingValue[destinationChainId] + msg.value;
    }

    function commitMessageBundle(uint256 destinationChainId) external {
        uint256 bundleValue = pendingValue[destinationChainId];
        bytes32[] storage pendingMessages = pendingMessageIdsForChainId[destinationChainId];
        bytes32 bundleRoot = Lib_MerkleTree.getMerkleRoot(pendingMessages);

        IHopMessageReceiver bridge = bridgeForChainId[destinationChainId];
        bridge.receiveMessageBundle{value: bundleValue}(bundleRoot, bundleValue, destinationChainId);
    }

    function receiveMessageBundle(
        bytes32 bundleRoot,
        uint256 bundleValue,
        uint256 destinationChainId
    )
        external
        payable
    {
        if (destinationChainId == getChainId()) {
            bytes32 bundleId = keccak256(abi.encodePacked(bundleRoot, bundleValue, destinationChainId));
            bundles[bundleId] = Bundle(bundleRoot, bundleValue);
        } else {
            // forward root to destination
        }
    }

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
        Bundle memory bundle = bundles[bundleId];
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

    function getMessageId(address from, address to, uint256 value, bytes memory message) public returns (bytes32) {
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
