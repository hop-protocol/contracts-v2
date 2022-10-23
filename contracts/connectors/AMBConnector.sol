// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/amb/LibAMB.sol";
import "../interfaces/xDai/messengers/IArbitraryMessageBridge.sol";
import "./Connector.sol";

contract AMBConnector is Connector {
    address public arbitraryMessageBridge;
    uint256 public immutable defaultGasLimit;

    constructor(address target, address _arbitraryMessageBridge, uint256 _defaultGasLimit) Connector(target) {
        arbitraryMessageBridge = _arbitraryMessageBridge;
        defaultGasLimit = _defaultGasLimit;
    }

    function _forwardCrossDomainMessage() internal override {
        IArbitraryMessageBridge(arbitraryMessageBridge).requireToPassMessage(
            arbitraryMessageBridge,
            msg.data,
            defaultGasLimit
        );
    }

    function _verifyCrossDomainSender() internal override view {
        address crossChainSender = LibAMB.crossChainSender(arbitraryMessageBridge);
        if (crossChainSender != counterpart) revert NotCounterpart();
    }
}
