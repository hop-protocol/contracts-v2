//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@hop-protocol/messenger/contracts/interfaces/ITransportLayer.sol";
import "./libraries/Error.sol";

abstract contract Transporter is Ownable, ITransportLayer {
    address public dispatcher;
    mapping(uint256 => mapping(bytes32 => bool)) public provenCommitments;

    modifier onlyDispatcher() {
        if (msg.sender != dispatcher) revert InvalidSender(msg.sender);
        _;
    }

    function setDispatcher(address _dispatcher) external {
        dispatcher = _dispatcher;
    }

    function isCommitmentProven(uint256 fromChainId, bytes32 commitment) external view returns (bool) {
        return provenCommitments[fromChainId][commitment];
    }

    function _setProvenCommitment(uint256 fromChainId, bytes32 commitment) internal {
        provenCommitments[fromChainId][commitment] = true;
        emit CommitmentProven(fromChainId, commitment);
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
