// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./ERC5164ConnectorFactory.sol";

contract HubERC5164ConnectorFactory is ERC5164ConnectorFactory {
    constructor(address _erc5164Messenger) ERC5164ConnectorFactory(_erc5164Messenger) {}

    function deployConnector(
        address target,
        uint256 counterpartChainId,
        address counterpartConnector,
        address counterpartTarget // Only used for create2 salt
    ) external override returns (address) {
        _deployConnector(target, counterpartChainId, counterpartConnector, counterpartTarget);
    }

    function _deployConnector(
        address target,
        uint256 counterpartChainId,
        address counterpartConnector,
        address counterpartTarget // Only used for create2 salt
    ) internal override returns (address) {
    }
}
