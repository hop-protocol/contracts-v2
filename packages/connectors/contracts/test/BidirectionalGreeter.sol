// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
/**
 * @dev This interface wraps the connector for calls made to a cross-chain Greeter contract.
 * @notice Functions called through connectors must be marked payable in this interface to ensure they
 * can receive ETH for the message fee when the cross-chain call is initiated on the source chain.
 */
interface ICrossChainGreeter {
    function setGreeting(string memory newGreeting) external payable;
}

/// @dev An example contract demonstrating a 1-to-1 crosschain relationship using Hop Connectors.
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

    function setConnector(address connector) external {
        require(greeterConnector == address(0), "Connector already set");
        greeterConnector = connector;
    }

    // ✉️ Send a greeting to the paired cross-chain Greeter contract ✉️
    function sendGreeting(string memory newGreeting) external payable {
        // Connectors can be called with a modified interface of the cross-chain contract.
        // It's as if it was on the same chain! No abi encoding required.
        // The forwarded msg.value pays for the message fee.
        ICrossChainGreeter(greeterConnector).setGreeting{value: msg.value}(newGreeting);
        emit GreetingSent(newGreeting);
    }

    // 📬 Receive a greeting from the paired cross-chain Greeter contract 📬
    function setGreeting(string memory newGreeting) external onlyConnector {
        greeting = newGreeting;
        emit GreetingSet(newGreeting);
    }
}
