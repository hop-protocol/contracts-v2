// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/optimism/LibOptimism.sol";
import "./Connector.sol";
import "../interfaces/optimism/messengers/iOVM_L2CrossDomainMessenger.sol";

contract L2OptimismConnector is Connector {
    address public immutable l2CrossDomainMessenger;
    uint32 public immutable defaultGasLimit;

    constructor(address _l2CrossDomainMessenger, uint32 _defaultGasLimit) {
        l2CrossDomainMessenger = _l2CrossDomainMessenger;
        defaultGasLimit = _defaultGasLimit;
    }

    function _forwardCrossDomainMessage() internal override {
        iOVM_L2CrossDomainMessenger(l2CrossDomainMessenger).sendMessage(
            counterpart,
            msg.data,
            defaultGasLimit
        );
    }

    function _verifyCrossDomainSender() internal override view {
        address crossChainSender = LibOptimism.crossChainSender(l2CrossDomainMessenger);
        if (crossChainSender != counterpart) revert InvalidCounterpart(crossChainSender);
    }
}
