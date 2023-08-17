// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "../ERC5164/IMessageDispatcher.sol";
import "../messenger/interfaces/ICrossChainFees.sol";
import "./ERC5164ConnectorFactory.sol";

contract HubERC5164ConnectorFactory is ERC5164ConnectorFactory, ICrossChainFees {
    // ToDo: Events

    constructor(
        address _messageDispatcher, 
        address _messageExecutor
    ) ERC5164ConnectorFactory (
        _messageDispatcher,
        _messageExecutor
    ) {}

    function deployConnectors(
        uint256 chainId1,
        address target1,
        uint256 chainId2,
        address target2
    )
        external
        payable
        returns (address)
    {
        address calculatedAddress = calculateAddress(chainId1, target1, chainId2, target2);

        triggerDeployment(calculatedAddress, chainId1, target1, chainId2, target2);
        triggerDeployment(calculatedAddress, chainId2, target2, chainId1, target1);

        return calculatedAddress;
    }

    function triggerDeployment(
        address calculatedAddress,
        uint256 chainId,
        address target,
        uint256 couterpartChainId,
        address counterpartTarget
    )
        internal
    {
        if (chainId == getChainId()) {
            address connector = _deployConnector(
                target,
                couterpartChainId,
                calculatedAddress,
                counterpartTarget
            );
            assert(calculatedAddress == connector);
        } else {
            IMessageDispatcher(messageDispatcher).dispatchMessage{value: msg.value}(
                chainId,
                address(this),
                abi.encodeWithSignature(
                    "deployConnector(address,uint256,address,address)",
                    target,
                    couterpartChainId,
                    calculatedAddress,
                    counterpartTarget
                )
            );
        }
    }

    function getFee(uint256[] calldata chainIds) external override view returns (uint256) {
        require(chainIds.length == 2, "HubERC5164ConnectorFactory: Invalid chainIds length");
        return ICrossChainFees(messageDispatcher).getFee(chainIds);
    }
}
