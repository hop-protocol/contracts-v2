// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./Connector.sol";
import "@hop-protocol/ERC5164/contracts/CrossChainEnabled.sol";
import "@hop-protocol/ERC5164/contracts/ISingleMessageDispatcher.sol";

contract HopConnector is Connector, CrossChainEnabled {
    uint256 public counterpartChainId;
    address public hopMessageBridge;

    constructor(
        uint256 _counterpartChainId,
        address _hopMessageBridge,
        address target
    )
        Connector(target) 
    {
        counterpartChainId = _counterpartChainId;
        hopMessageBridge = _hopMessageBridge;
    }

    function _forwardCrossDomainMessage() internal override {
        ISingleMessageDispatcher(hopMessageBridge).dispatchMessage(counterpartChainId, target, msg.data);
    }

    function _verifyCrossDomainSender() internal override view {
        (bytes32 messageId, uint256 fromChainId, address from) = _crossChainContext();

        if (from != counterpart) revert InvalidCounterpart(from);
        if (msg.sender != hopMessageBridge) revert InvalidBridge(msg.sender);
        if (fromChainId != counterpartChainId) revert InvalidFromChainId(fromChainId);
    }
}
