//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

// SafeTransfer
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract HopStaking {
    using SafeERC20 for IERC20;

    address public hopToken;
    address public governance;
    mapping(bytes32 => mapping(address => uint256)) public balances;

    struct PendingUnstake {
        bytes32 role;
        address staker;
        uint256 amount;
        uint256 started;
        uint256 completed;
        address slasher;
    }

    PendingUnstake[] pendingUnstakes;

    mapping(bytes32 => uint256) challengePeriod;

    function stake(bytes32 role, uint256 amount) external {
        balances[role][msg.sender] += amount;
        // emit HopStaked(role, msg.sender, amount);
        IERC20(hopToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    function startUnstake(bytes32 role, uint256 amount) external {
        _unstake(role, msg.sender, amount, address(0));
    }

    function unstakeAndSlash(bytes32 role, address staker, uint256 amount) external /* onlySlasher */ {
        _unstake(role, staker, amount, msg.sender);
    }

    function slash(uint256 unstakeIndex) external /* onlySlasher */ {
        PendingUnstake storage pendingUnstake = pendingUnstakes[unstakeIndex];
        pendingUnstake.slasher = msg.sender;
    }

    function _unstake(
        bytes32 role,
        address staker,
        uint256 amount,
        address slasher
    ) internal {
        pendingUnstakes.push(PendingUnstake(
            role,
            staker,
            amount,
            block.timestamp,
            0,
            slasher
        ));

        balances[role][msg.sender] -= amount;

        // emit UnstakeStarted(role, staker, amount, slasher);
    }

    function completeUnstake(uint256 unstakeIndex) external {
        PendingUnstake storage pendingUnstake = pendingUnstakes[unstakeIndex];
        require(pendingUnstake.slasher == address(0), "HopStaking: connot complete slashed unstake");
        require(pendingUnstake.completed != 0, "HopStaking: unstake already completed");
        pendingUnstake.completed = block.timestamp;

        require(pendingUnstake.started > 0, "HopStaking: unstake not started");
        uint256 timeSinceUnstakeStarted = block.timestamp - pendingUnstake.started;
        require(timeSinceUnstakeStarted >= challengePeriod[pendingUnstake.role], "HopStaking: challenge period not complete");

        IERC20(hopToken).safeTransfer(pendingUnstake.staker, pendingUnstake.amount);
    }

    function resolveSlash(uint256 unstakeIndex, uint256 adjustedAmount) external /* onlyOwner */ {
        PendingUnstake storage pendingUnstake = pendingUnstakes[unstakeIndex];

        require(pendingUnstake.completed != 0, "HopStaking: slash already completed");
        pendingUnstake.completed = block.timestamp;

        require(adjustedAmount <= pendingUnstake.amount, "HopStaking: adjusted amount cannot be greater");

        uint256 balanceReturned = pendingUnstake.amount - adjustedAmount;
        balances[pendingUnstake.role][pendingUnstake.staker] += balanceReturned;

        IERC20(hopToken).safeTransfer(governance, adjustedAmount);
    }

    function getUnstakeId(
        bytes32 role,
        address staker,
        uint256 amount,
        uint256 unstakeNonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(role, staker, amount, unstakeNonce));
    }

    function getSlashId(
        bytes32 role,
        address staker,
        address slasher,
        uint256 amount,
        uint256 slashNonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(role, staker, amount, slashNonce));
    }
}
