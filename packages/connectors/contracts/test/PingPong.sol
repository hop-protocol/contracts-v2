// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract PingPong {
    address public counterpart;
    uint256 public messagesSent = 0;
    uint256 public messagesReceived = 0;

    event Ping(uint256 rallyCount);
    event Pong(uint256 rallyCount);

    // Uses standard access controls. No cross-chain logic required!
    modifier onlyCounterpart() {
        require(msg.sender == counterpart, "PingPong: only counterpart");
        _;
    }

    function setCounterpart(address _counterpart) external {
        require(counterpart == address(0), "PingPong: counterpart already set");
        require(_counterpart != address(0), "PingPong: counterpart cannot be zero address");
        counterpart = _counterpart;
    }

    function ping(uint256 rallyCount) public payable {
        // Track number of messages sent for demonstration purposes
        messagesSent++;
        emit Ping(rallyCount);

        // The message fee (msg.value) is forwarded to the connector
        PingPong(counterpart).pong{value: msg.value}(rallyCount);
    }

    function pong(uint256 rallyCount) external payable onlyCounterpart {
        // Track number of messages received for demonstration purposes
        messagesReceived++;
        emit Pong(rallyCount);

        // If rally is not over, send a ping back
        if (rallyCount > 0) {
            ping(rallyCount - 1);
        }
    }
}
