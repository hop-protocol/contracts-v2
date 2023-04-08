// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/ERC5164/contracts/MessageReceiver.sol";
import "@hop-protocol/ERC5164/contracts/IMessageDispatcher.sol";

contract MultichainGreeter is MessageReceiver {
    address public hopMessenger;
    string public greeting;

    event GreetingSent(string newGreeting, uint256 toChainId, address to);
    event GreetingSet(string newGreeting, bytes32 messageId, uint256 fromChainId, address from);

    constructor(string memory initialGreeting) {
        greeting = initialGreeting;
    }

    function setMessenger(address connector) external {
        require(hopMessenger == address(0), "Messenger already set");
        hopMessenger = connector;
    }

    // ✉️ Send a greeting to the paired cross-chain Greeter contract ✉️
    function sendGreeting(uint256 toChainId, address to, string memory newGreeting) external {
        // Get the encoded the cross-chain message
        bytes memory data = abi.encodeWithSignature(
            "setGreeting(string)",
            newGreeting
        );

        // Call the ERC-5164 method `dispatchMessage` on the messenger contract
        IMessageDispatcher(hopMessenger).dispatchMessage(
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
        // require(fromChainId == crossChainGreeterChainId, "Invalid crossChainGreeterChainId");
        // require(from == crossChainGreeter, "Invalid crossChainGreeter");

        emit GreetingSet(newGreeting, messageId, fromChainId, from);
        greeting = newGreeting;
    }
}
