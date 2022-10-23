// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../polygon/tunnel/FxBaseRootTunnel.sol";
import "./Connector.sol";

contract L1ArbitrumConnector is Connector, FxBaseRootTunnel {
    address public fxRootTunnel;

    constructor(
        address target,
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    )
        Connector(target)
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        setFxChildTunnel(_fxChildTunnel);
    }

    function _forwardCrossDomainMessage() internal override {
        _sendMessageToChild(msg.data);
    }

    function _verifyCrossDomainSender() internal override pure {
        revert NotCounterpart();
    }

    function _processMessageFromChild(bytes memory message) internal override {
        (bool success,) = target.call(message);
        require(success, "CNR: Failed to forward message");
    }
}
