//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

error Unauthorized(address expected, address actual);
error XDomainMessengerNotSet();

contract MessageForwarder {
    address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
    address private xDomainSender = DEFAULT_XDOMAIN_SENDER;
    address messageSource;

    constructor(address _messageSource) {
        messageSource = _messageSource;
    }

    function forward(address from, address to, bytes calldata data) external returns (bool) {
        if (msg.sender != messageSource) {
            revert Unauthorized(messageSource, msg.sender);
        }
        xDomainSender = from;
        // (bool success, ) = to.call{value: value}(data);
        (bool success, ) = to.call(data);
        xDomainSender = DEFAULT_XDOMAIN_SENDER;
        return success;
    }

    function xDomainMessageSender() public view returns (address) {
        if(xDomainSender != DEFAULT_XDOMAIN_SENDER) {
            revert XDomainMessengerNotSet();
        }
        return xDomainSender;
    }
}