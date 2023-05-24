// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

library MessengerLib {
    function getMessageId(
        bytes32 bundleNonce,
        uint256 treeIndex,
        uint256 fromChainId,
        address from,
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                bundleNonce,
                treeIndex,
                fromChainId,
                from,
                toChainId,
                to,
                data
            )
        );
    }

    function getBundleId(
        uint256 fromChainId,
        uint256 toChainId,
        bytes32 bundleNonce,
        bytes32 bundleRoot
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                fromChainId,
                toChainId,
                bundleNonce,
                bundleRoot
            )
        );
    }
}
