// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/aliases/AliasDeployer.sol";
import "@hop-protocol/messenger/messenger/Dispatcher.sol";

contract CrossChainFees {
    function getFee(uint256[] calldata chainIds) external view returns (uint256) {
        return 0;
    }
}
