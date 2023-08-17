// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @dev An example contract demonstrating cross-chain messaging using a Hop cross-chain Alias
contract Greeter {
    address public governanceAlias;
    string public greeting;

    event GreetingSet(string newGreeting);

    modifier onlyGovernanceAlias() {
        require(msg.sender == governanceAlias, "Only governance alias");
        _;
    }

    constructor (address _governanceAlias) {
        governanceAlias = _governanceAlias;
    }

    // 📬 Receive a greeting from a cross-chain sender 📬
    function setGreeting(string memory newGreeting) external onlyGovernanceAlias {
        emit GreetingSet(newGreeting);
        greeting = newGreeting;
    }
}
