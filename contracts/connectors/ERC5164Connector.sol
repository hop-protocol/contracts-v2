// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../ERC5164/MessageReceiver.sol";
import "../ERC5164/IMessageDispatcher.sol";
import "../messenger/interfaces/ICrossChainFees.sol";
import "./Connector.sol";

contract ERC5164Connector is Connector, MessageReceiver, ICrossChainFees {
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

    function getFee(uint256[] calldata chainIds) external override view returns (uint256) {
        require(chainIds.length == 1, "ERC5164Connector: Invalid chainIds length");
        return ICrossChainFees(messageDispatcher).getFee(chainIds);
    }
}
