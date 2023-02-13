// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./ERC5164Connector.sol";

contract ERC5164ConnectorFactory {
    address public erc5164Messenger;

    constructor(
        address _erc5164Messenger
    ) {
        erc5164Messenger = _erc5164Messenger;
    }

    function deploy(
        address target,
        uint256 counterpartChainId,
        address counterpart,
        address counterpartTarget // Only used for create2 salt
    ) external returns (address) {
        uint256 chainId = getChainId();
        bytes32 create2Salt = getSalt(target, chainId, counterpartTarget, counterpartChainId);

        bytes memory bytecode = type(ERC5164Connector).creationCode;
        address connector = Create2.deploy(0, create2Salt, bytecode);
        ERC5164Connector(connector).setCounterpart(counterpart);

        // ToDo: Emit deployed event
        return connector;
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

    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
