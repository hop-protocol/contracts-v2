//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

contract OverridableChainId {
    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
