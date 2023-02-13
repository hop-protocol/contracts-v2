// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./Connector.sol";
import "@hop-protocol/ERC5164/contracts/CrossChainEnabled.sol";
import "@hop-protocol/ERC5164/contracts/ISingleMessageDispatcher.sol";

contract ERC5164Connector is Connector, CrossChainEnabled {
    uint256 public counterpartChainId;
    address public erc5164Bridge;

    constructor(
        uint256 _counterpartChainId,
        address _erc5164Bridge,
        address target
    )
        Connector(target) 
    {
        counterpartChainId = _counterpartChainId;
        erc5164Bridge = _erc5164Bridge;
    }

    function _forwardCrossDomainMessage() internal override {
        ISingleMessageDispatcher(erc5164Bridge).dispatchMessage(counterpartChainId, target, msg.data);
    }

    function _verifyCrossDomainSender() internal override view {
        (bytes32 messageId, uint256 fromChainId, address from) = _crossChainContext();

        if (from != counterpart) revert InvalidCounterpart(from);
        if (msg.sender != erc5164Bridge) revert InvalidBridge(msg.sender);
        if (fromChainId != counterpartChainId) revert InvalidFromChainId(fromChainId);
    }
}
