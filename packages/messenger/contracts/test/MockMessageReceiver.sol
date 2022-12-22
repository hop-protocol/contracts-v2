//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;
import "../erc5164/CrossChainEnabled.sol";
import "hardhat/console.sol";

interface IHopMessenger {
    function getCrossChainSender() external returns (address);
    function getCrossChainChainId() external returns (uint256);
}

contract MockMessageReceiver is CrossChainEnabled {
    IHopMessenger public messenger;

    uint256 public result;
    address public msgSender;
    address public xDomainSender;
    uint256 public xDomainChainId;

    constructor(IHopMessenger _messenger) {
        messenger = _messenger;
    }

    function setResult(uint256 _result) external payable {
        result = _result;
        msgSender = msg.sender;
        (xDomainChainId, xDomainSender) = _crossChainContext();
    }
}
