// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./Connector.sol";
import "@hop-protocol/ERC5164/contracts/MessageReceiver.sol";
import "@hop-protocol/ERC5164/contracts/IMessageDispatcher.sol";

contract ERC5164Connector is Connector, MessageReceiver {
    uint256 public counterpartChainId;
    address public messageDispatcher;
    address public messageExecutor;

    function initialize(
        address target,
        address counterpart,
        address _messageDispatcher,
        address _messageExecutor,
        uint256 _counterpartChainId
    ) external {
        initialize(target, counterpart);
        messageDispatcher = _messageDispatcher;
        messageExecutor = _messageExecutor;
        counterpartChainId = _counterpartChainId;
    }

    function _forwardCrossDomainMessage() internal override {
        IMessageDispatcher(messageDispatcher).dispatchMessage{value: msg.value}(
            counterpartChainId,
            counterpart,
            msg.data
        );
    }

    function _verifyCrossDomainSender() internal override view {
        (, uint256 fromChainId, address from) = _crossChainContext();

        if (from != counterpart) revert InvalidCounterpart(from);
        if (msg.sender != messageExecutor) revert InvalidBridge(msg.sender);
        if (fromChainId != counterpartChainId) revert InvalidFromChainId(fromChainId);
    }
}
