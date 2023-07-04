//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Bridge {
    address public token;
    address public dispatcher;
    address public executor;

    function send(
        uint256 chainId,
        address recipient,
        uint256 amount,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline
    ) external {

    }

    function bond(
        address recipient,
        uint256 amount,
        bytes32 transferNonce,
        uint256 bonderFee,
        uint256 amountOutMin,
        uint256 deadline
    )
        external
        // onlyBonder
        // requirePositiveBalance
        // nonReentrant
    {

    }

    function challenge(bytes32 trasnferId) external {

    }

    function resolveChallenge(bytes32 trasnferId)  external {
        
    }

    function commitSettlement() external {
        // send pending amount through settlement layer
    }
}
