// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/ERC5164/contracts/IMessageDispatcher.sol";
import "./Alias.sol";

contract AliasDispatcher is IMessageDispatcher {
    address public sourceAddress;
    address public baseDispatcher;
    mapping(uint256 => address) public aliasForChainId;

    constructor(address _sourceAddress, address _baseDispatcher) {
        sourceAddress = _sourceAddress;
        baseDispatcher = _baseDispatcher;
    }

    function addAlias(uint256 chainId, address _aliasForChainId) external {
        aliasForChainId[chainId] = _aliasForChainId;
    }

    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32) {
        return dispatchMessageWithValue(toChainId, to, 0, data);
    }

    function dispatchMessageWithValue(
        uint256 toChainId,
        address to,
        uint256 value,
        bytes calldata data
    )
        public
        payable
        returns (bytes32)
    {
        bytes4 selector = Alias(payable(address(0))).forwardMessage.selector;
        bytes memory encodedData = abi.encodeWithSelector(selector, to, value, data);

        address aliasAddress = aliasForChainId[toChainId];
        return IMessageDispatcher(baseDispatcher).dispatchMessage(toChainId, aliasAddress, encodedData);
    }
}