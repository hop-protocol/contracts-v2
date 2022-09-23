//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

// import "./libraries/Message.sol";

// error Unauthorized(address expected, address actual);
// error XDomainMessengerNotSet();

// contract MessageForwarder {
//     address private constant DEFAULT_XDOMAIN_SENDER = 0x000000000000000000000000000000000000dEaD;
//     address private xDomainSender = DEFAULT_XDOMAIN_SENDER;
//     address messageSource;

//     constructor(address _messageSource) {
//         messageSource = _messageSource;
//     }

//     function forward(Message calldata message) external payable returns (bool) {
//         // ToDo: Require msg.value == message.value
//         if (msg.sender != messageSource) {
//             revert Unauthorized(messageSource, msg.sender);
//         }

//         xDomainSender = message.from;
//         (bool success, ) = message.to.call{value: message.value}(message.data);
//         xDomainSender = DEFAULT_XDOMAIN_SENDER;

//         return success;
//     }

//     function xDomainMessageSender() public view returns (address) {
//         if(xDomainSender != DEFAULT_XDOMAIN_SENDER) {
//             revert XDomainMessengerNotSet();
//         }
//         return xDomainSender;
//     }
// }