//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IMessageExecutor.sol";

contract MessageExecutor is IMessageExecutor {
    error CallFailedForUnknownReason();

    function _execute(address to, bytes memory data, uint256 fromChainId, address from) internal {
        (bool success, bytes memory returnData) = to.call(
            abi.encodePacked(data, fromChainId, from)
        );
        if (success) return;

        // handle revert
        if (returnData.length > 0) {
            assembly {
                let returnDataSize := mload(returnData)
                revert(add(32, returnData), returnDataSize)
            }
        } else {
            revert CallFailedForUnknownReason();
        }
    }
}
