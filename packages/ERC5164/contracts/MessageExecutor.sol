//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IMessageExecutor.sol";

contract MessageExecutor is IMessageExecutor {
    error CallFailedForUnknownReason();

    function _execute(
        bytes32 messageId,
        uint256 fromChainId,
        address from,
        address to,
        bytes memory data
    )
        internal
    {
        (bool success, bytes memory returnData) = to.call(
            abi.encodePacked(data, messageId, fromChainId, from)
        );

        if (success) {
            emit MessageExecuted(fromChainId, messageId);
        } else if (returnData.length > 0) {
            // Bubble up the revert reason
            assembly {
                let returnDataSize := mload(returnData)
                revert(add(32, returnData), returnDataSize)
            }
        } else {
            revert CallFailedForUnknownReason();
        }
    }
}
