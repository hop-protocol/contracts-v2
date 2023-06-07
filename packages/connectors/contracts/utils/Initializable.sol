// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract Initializable {
    bool initialized;

    modifier initializer() {
        require(!initialized, "Initializable: contract is already initialized");
        initialized = true;
        _;
    }
}