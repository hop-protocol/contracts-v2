//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./HopStaking.sol";

contract BonderRegistry {
    bytes32 public constant bonderRole = keccak256(abi.encode("Hop Bonder Role"));
    address public hopStaking;
    uint256 public minBonderStake = 1 ** 27; // 1M HOP
    mapping(address => bool) activeBonders;

    function activateBonder() external {
        activeBonders[msg.sender] = true;
    }

    function deactivateBonder() external {
        _deactivateBonder(msg.sender);
    }

    function _deactivateBonder(address bonder) internal {
        activeBonders[bonder] = false;
    }

    function isBonderStakedAndActive(address bonder) external returns (bool) {
        uint256 amountStaked = HopStaking(hopStaking).balances(bonderRole, bonder);
        if(amountStaked < minBonderStake) {
            _deactivateBonder(bonder);
            return false;
        }

        return activeBonders[bonder];
    }
}
