//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;
import "hardhat/console.sol";

contract MessageReceiver {
    uint256 public result;

    function setResult(uint256 _result) external payable {
        result = _result;
    }
}
