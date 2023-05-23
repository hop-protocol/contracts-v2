// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AliasFactory.sol";
import "../utils/OverridableChainId.sol";

interface IAliasFactory {
    function deployAlias(uint256 sourceChainId, address sourceAddress, address aliasDispatcher) external payable returns (address);
    function deployAliasDispatcher(address sourceAddress) external payable returns (address);
}

/// @dev AliasDeployer calls the AliasFactory's to deploy aliases on multiple chains.
contract AliasDeployer is OverridableChainId, Ownable {
    uint256 public constant crossChainMessageFee = 0;
    // address for factory or factory connector
    mapping(uint256 => address) public aliasFactoryForChainId;

    function deployAliases(
        uint256 sourceChainId,
        address sourceAddress,
        uint256[] calldata aliasChainIds
    )
        external
        payable
    {
        uint256 thisChainId = getChainId();

        IAliasFactory aliasFactory = IAliasFactory(aliasFactoryForChainId[sourceChainId]);
        uint256 messageFee = thisChainId == sourceChainId ? 0 : crossChainMessageFee;
        address aliasDispatcher = aliasFactory.deployAliasDispatcher{value: messageFee}(sourceAddress);

        for(uint256 i = 0; i < aliasChainIds.length; i++) {
            uint256 chainId = aliasChainIds[i];
            deployAlias(chainId, sourceChainId, sourceAddress, aliasDispatcher);
        }

        // ToDo: Refund excess message fees
    }

    function deployAlias(uint256 chainId, uint256 sourceChainId, address sourceAddress, address aliasDispatcher) public payable {
        IAliasFactory factoryOrConnector = IAliasFactory(aliasFactoryForChainId[chainId]);
        uint256 messageFee = getChainId() == chainId ? 0 : crossChainMessageFee;
        factoryOrConnector.deployAlias{value: messageFee}(sourceChainId, sourceAddress, aliasDispatcher);
    }

    function setAliasFactoryForChainId(uint256 chainId, address factory) external onlyOwner {
        aliasFactoryForChainId[chainId] = factory;
    }
}