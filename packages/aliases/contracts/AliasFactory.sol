// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@hop-protocol/shared-solidity/contracts/OverridableChainId.sol";
import "./Alias.sol";
import "./AliasDispatcher.sol";

contract AliasFactory is OverridableChainId {
    address public baseDispatcher;
    address public baseExecutor;

    event AliasDeployed(
        address indexed aliasAddress,
        uint256 indexed sourceChainId,
        address indexed sourceAddress,
        address aliasDispatcher
    );

    event AliasDispatcherDeployed(
        address indexed dispatcher,
        address sourceAddress,
        address aliasDispatcher
    );

    constructor(address _baseDispatcher, address _baseExecutor) {
        baseDispatcher = _baseDispatcher;
        baseExecutor = _baseExecutor;
    }

    function deployAlias(
        uint256 sourceChainId,
        address sourceAddress,
        address aliasDispatcher
    )
        external
        returns (address)
    {
        bytes32 create2Salt = getAliasSalt(
            sourceChainId,
            sourceAddress,
            aliasDispatcher
        );
        address payable aliasAddress = payable(
            Create2.deploy(0, create2Salt, type(Alias).creationCode)
        );
        assert(aliasAddress == calculateAliasAddress(sourceChainId, sourceAddress, aliasDispatcher));

        Alias(aliasAddress).initialize(
            baseExecutor,
            sourceChainId,
            aliasDispatcher
        );

        emit AliasDeployed(
            aliasAddress,
            sourceChainId,
            sourceAddress,
            aliasDispatcher
        );

        return aliasAddress;
    }

    function deployAliasDispatcher(address sourceAddress) external returns (address) {
        bytes32 create2Salt = getAliasDispatcherSalt(sourceAddress);
        address payable aliasDispatcher = payable(
            Create2.deploy(0, create2Salt, type(AliasDispatcher).creationCode)
        );
        assert(aliasDispatcher == calculateAliasDispatcherAddress(sourceAddress));

        AliasDispatcher(aliasDispatcher).initialize(sourceAddress, baseDispatcher);

        emit AliasDispatcherDeployed(
            aliasDispatcher,
            sourceAddress,
            baseDispatcher
        );
        return aliasDispatcher;
    }

    function calculateAliasAddress(
        uint256 sourceChainId,
        address sourceAddress,
        address aliasDispatcher
    )
        public
        view
        returns (address)
    {
        bytes32 create2Salt = getAliasSalt(sourceChainId, sourceAddress, aliasDispatcher);
        bytes memory bytecode = type(Alias).creationCode;
        bytes32 bytecodeHash = keccak256(bytecode);

        return Create2.computeAddress(create2Salt, bytecodeHash);
    }

    function calculateAliasDispatcherAddress(address sourceAddress) public view returns (address) {
        bytes32 create2Salt = getAliasDispatcherSalt(sourceAddress);
        bytes memory bytecode = type(AliasDispatcher).creationCode;
        bytes32 bytecodeHash = keccak256(bytecode);

        return Create2.computeAddress(create2Salt, bytecodeHash);
    }

    function getAliasSalt(
        uint256 sourceChainId,
        address sourceAddress,
        address aliasDispatcher
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sourceChainId, sourceAddress, aliasDispatcher));
    }

    function getAliasDispatcherSalt(address sourceAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sourceAddress));
    }
}
