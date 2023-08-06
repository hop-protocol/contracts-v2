//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;
import "@hop-protocol/ERC5164/contracts/MessageReceiver.sol";

interface IHopMessenger {
    function getCrossChainSender() external returns (address);
    function getCrossChainChainId() external returns (uint256);
}

contract MockMessageReceiver is MessageReceiver {
    IHopMessenger public messenger;

    uint256 public result;
    address public msgSender;
    bytes32 public messageId;
    uint256 public xDomainChainId;
    address public xDomainSender;

    constructor(IHopMessenger _messenger) {
        messenger = _messenger;
    }

    function setResult(uint256 _result) external payable {
        result = _result;
        msgSender = msg.sender;
        (messageId, xDomainChainId, xDomainSender) = _crossChainContext();
    }
}
