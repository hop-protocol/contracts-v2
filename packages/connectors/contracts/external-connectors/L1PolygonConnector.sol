// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../polygon/tunnel/FxBaseRootTunnel.sol";
import "../connectors/Connector.sol";

contract L1PolygonConnector is Connector, FxBaseRootTunnel {
    constructor(
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    )
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        setFxChildTunnel(_fxChildTunnel);
    }

    function _forwardCrossDomainMessage() internal override {
        _sendMessageToChild(msg.data);
    }

    function _verifyCrossDomainSender() internal override pure {
        revert InvalidCounterpart(address(0));
    }

    function _processMessageFromChild(bytes memory message) internal override {
        (bool success,) = target.call(message);
        require(success, "CNR: Failed to forward message");
    }
}
