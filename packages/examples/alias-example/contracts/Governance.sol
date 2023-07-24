// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/aliases/contracts/AliasDispatcher.sol";

contract Governance {
    address public aliasDisptacher;

    function setAliasDispatcher(address _aliasDisptacher) external {
        aliasDisptacher = _aliasDisptacher;
    }

    function setCrossChainGreeting(uint256 toChainId, address greeter, string calldata greeting) external payable {
        // Get the encoded the cross-chain message
        bytes memory data = abi.encodeWithSignature(
            "setGreeting(string)",
            greeting
        );

        // Call `dispatchMessage` on this contract's the AliasDispatcher contract
        AliasDispatcher(aliasDisptacher).dispatchMessage{value: msg.value}(
            toChainId,
            greeter,
            data
        );
    }
}