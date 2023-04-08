// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract BidirectionalGreeter {
    address public greeterConnector;
    string public greeting;

    event GreetingSent(string newGreeting);
    event GreetingSet(string newGreeting);

    // 🔒 Use established security patterns like `Ownable`'s `onlyOwner` modifier 🔒
    modifier onlyConnector() {
        // Calls from the paired Greeter contract will come from the connector.
        require(msg.sender == greeterConnector, "BidirectionalGreeter: Only connector");
        _;
    }

    constructor(string memory initialGreeting) {
        greeting = initialGreeting;
    }

    function setConnector(address connector) external {
        require(greeterConnector == address(0), "Connector already set");
        greeterConnector = connector;
    }

    // ✉️ Send a greeting to the paired cross-chain Greeter contract ✉️
    function sendGreeting(string memory newGreeting) external {
        // Connectors can be called with the interface of the cross-chain contract.
        // It's as if it was on the same chain! No abi encoding required.
        BidirectionalGreeter(greeterConnector).setGreeting(newGreeting);
        emit GreetingSent(newGreeting);
    }

    // 📬 Receive a greeting from the paired cross-chain Greeter contract 📬
    function setGreeting(string memory newGreeting) external onlyConnector {
        greeting = newGreeting;
        emit GreetingSet(newGreeting);
    }
}