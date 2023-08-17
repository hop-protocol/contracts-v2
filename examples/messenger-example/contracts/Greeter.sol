// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/ERC5164/MessageReceiver.sol";
import "@hop-protocol/ERC5164/IMessageDispatcher.sol";

/// @dev An example contract demonstrating cross-chain messaging with a ERC5164 messenger such as the Hop Core Messenger.
contract Greeter is MessageReceiver {
    address public dispatcher;
    address public executor;
    string public greeting;

    event GreetingSent(string newGreeting, uint256 toChainId, address to);
    event GreetingSet(string newGreeting, bytes32 messageId, uint256 fromChainId, address from);

    constructor (address _dispatcher, address _executor) {
        dispatcher = _dispatcher;
        executor = _executor;
    }

    // ✉️ Send a greeting to the paired cross-chain Greeter contract ✉️
    function sendGreeting(uint256 toChainId, address to, string memory newGreeting) external payable {
        // Get the encoded the cross-chain message
        bytes memory data = abi.encodeWithSignature(
            "setGreeting(string)",
            newGreeting
        );

        // Call the ERC-5164 method `dispatchMessage` on the messenger contract
        IMessageDispatcher(dispatcher).dispatchMessage{value: msg.value}(
            toChainId,
            to,
            data
        );
    }

    // 📬 Receive a greeting from a cross-chain sender 📬
    function setGreeting(string memory newGreeting) external {

        // `_crossChainContext()` from the imported `MessageReceiver` contract returns the ERC-5164
        // message metadata used for validating the cross-chain sender and tracking the message.
        (bytes32 messageId, uint256 fromChainId, address from) = _crossChainContext();

        // 🔒 Example cross-chain sender validation 🔒
        // require(msg.sender == executor, "Only executor");
        // require(fromChainId == crossChainGreeterChainId, "Invalid crossChainGreeterChainId");
        // require(from == crossChainGreeter, "Invalid crossChainGreeter");

        emit GreetingSet(newGreeting, messageId, fromChainId, from);
        greeting = newGreeting;
    }
}
