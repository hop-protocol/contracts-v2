// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/utils/Create2.sol";
import "../shared-solidity/OverridableChainId.sol";
import "./ERC5164Connector.sol";

contract ERC5164ConnectorFactory is OverridableChainId {
    address public messageDispatcher;
    address public messageExecutor;

    event ConnectorDeployed(
        address indexed connector,
        address indexed target,
        uint256 counterpartChainId,
        address indexed counterpartConnector,
        address counterpartTarget
    );

    constructor(address _messageDispatcher, address _messageExecutor) {
        messageDispatcher = _messageDispatcher;
        messageExecutor = _messageExecutor;
    }

    function deployConnector(
        address target,
        uint256 counterpartChainId,
        address counterpartConnector,
        address counterpartTarget // Only used for create2 salt
    )
        external
        returns (address)
    {
        return _deployConnector(target, counterpartChainId, counterpartConnector, counterpartTarget);
    }

    function _deployConnector(
        address target,
        uint256 counterpartChainId,
        address counterpartConnector,
        address counterpartTarget // Only used for create2 salt
    )
        internal
        returns (address)
    {
        // ToDo: onlyCounterpart or calculate connector address
        uint256 chainId = getChainId();
        bytes32 create2Salt = getSalt(target, chainId, counterpartTarget, counterpartChainId);
        address payable connector = payable(
            Create2.deploy(0, create2Salt, type(ERC5164Connector).creationCode)
        );
        assert(connector == calculateAddress(chainId, target, counterpartChainId, counterpartTarget));

        ERC5164Connector(connector).initialize(
            target,
            counterpartConnector,
            messageDispatcher,
            messageExecutor,
            counterpartChainId
        );

        emit ConnectorDeployed(
            connector,
            target,
            counterpartChainId,
            counterpartConnector,
            counterpartTarget
        );

        return connector;
    }

    function calculateAddress(
        uint256 chainId1,
        address target1,
        uint256 chainId2,
        address target2
    )
        public
        view
        returns (address)
    {
        bytes32 create2Salt = getSalt(target1, chainId1, target2, chainId2);
        bytes memory bytecode = type(ERC5164Connector).creationCode;
        bytes32 bytecodeHash = keccak256(bytecode);

        return Create2.computeAddress(create2Salt, bytecodeHash);
    }

    function getSalt(
        address target1,
        uint256 chainId1,
        address target2,
        uint256 chainId2
    ) public pure returns (bytes32) {
        if (chainId1 < chainId2) {
            return keccak256(abi.encodePacked(target1, chainId1, target2, chainId2));
        } else {
            return keccak256(abi.encodePacked(target2, chainId2, target1, chainId1));
        }
    }
}
