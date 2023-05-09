//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

// Cross-chain messenger

// Message flow
// Dispatcher -> Transporter 1 -> Transporter 2 -> ValidationManager -> Executor
// The Dispatcher and Transporter 1 are on the source chain
// The  Transporter 2, ValidationManager, and Executor are on the destination chain

// Send() adds message Id to bundle
// Complete bundle gets sent to transport aggregator
// Transport aggregator splits fees and triggers transports
// hashes can be proven in destination transport aggregator
// Each messenger may register 1 message validator and 1 bundle validator
// Message validators are called at execution time
// Bundle validators are called ahead and successful result is stored

contract Dispatcher {
    // Should be light-weight to allow distributor to be upgraded
    // Collects fees
    // Makes bundles
    // Handle DMs
    // Stores messages for third party transport layers and cross-chain storage proofs
    // Stores bundle for third party transport layers and cross-chain storage proofs
    // dispatchMessage(uint256 toChainId, address to, bytes calldata data)
}

contract Transporter {
    // Swapable
    // Routes bundle hashes and fees to transport layers
    // transportCommitment(uint256 toChainId, bytes32 commitment) payable
}

contract ValidationManager {
    // Allows validity check of bundles
    // Store validity check attestations
    // Allows receiving addresses to register custum validity checks by defining a custom function
    // and calling `register(address)` on this contract
    // Allows message hashes to be posted and registered with their bundleId and calculated bundle root
    // register(address to)
    // postBundle(uint256 fromChainId, bytes32 bundleId, bytes32[] calldata messageIds)
    // proveBundle(address bundleValidator, bytes32 bundleId, bytes calldata proof) returns (bool)
    // isMessageVerified(bytes32 bundleId, bytes32 messageId, address messageReceiver) returns (bool)
}

contract Executor {
    // execute fromChainId, from, message, bundleId, bundleIndex
    // Calls receiving address to check for custom attestations
    // Handles replay protection
    // executeMessage(uint256 fromChainId, address from, address to, bytes calldata data)
}





interface IHopMessageReceiver {
    function hopBundleVerifier() external view returns (address);
    function hopMessageVerifier() external view returns (address);
}


contract ISourceTransporter {
    // transportCommitment(uint256 toChainId, bytes32 commitment) payable
}

contract IDestinationTransporter {
    // isProven(uint256 fromChainId, bytes32 commitment) returns (bool)
    // proveCommitment(uint256 fromChainId, bytes32 commitment, bytes calldata proof) returns (bool)
}

contract IMessageValidator {
    // isValid(bytes32 bundleId, bytes32 messageId) returns (bool)
    // isValid(bytes32 bundleId, bytes32 messageId, bytes calldata proof) returns (bool)
}

interface IBundleVerifier {
    function isBundleValid(uint256 fromChainId, bytes32 bundleId, bytes32 bundleRoot) external returns (bool);
}


// Bonus: Executor allows partial posts of message hashes and a bundleId


contract NativeTransport {

}

contract HubNativeTransport {

}

contract SpokeNativeTransport {
    // Handles fee aggreagtion
    // sends fees to hub
    // sends hash to hub
}