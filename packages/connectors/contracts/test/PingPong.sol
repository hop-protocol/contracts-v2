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

    constructor(address _counterpart) {
        counterpart = _counterpart;
    }

    function ping(uint256 rallyCount) public {
        // Track number of messages sent for demonstration purposes
        messagesSent++;
        emit Ping(rallyCount);
        PingPong(counterpart).pong(rallyCount);
    }

    function pong(uint256 rallyCount) external {
        // Track number of messages received for demonstration purposes
        messagesReceived++;
        emit Pong(rallyCount);

        // If rally is not over, send a ping back
        if (rallyCount > 0) {
            ping(rallyCount - 1);
        }
    }
}
