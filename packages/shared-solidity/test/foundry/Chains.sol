
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;
import {StdChains} from "forge-std/StdChains.sol";
import {Vm} from "forge-std/Vm.sol";
import {console} from "forge-std/Console.sol";

struct Chain {
    string name;
    uint256 chainId;
    string chainAlias;
    string rpcUrl;
}

contract Chains is StdChains {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    mapping(uint256 => uint256) public forkIdForChainId;

    constructor() {
        // set non-standard chains
        setChain(
            "base_goerli", 
            Chain(
                "Base Goerli",
                84531,
                "base_goerli",
                vm.envString("RPC_ENDPOINT_BASE_GOERLI")
            )
        );

        // Hacky way to burn forkId 0
        Chain memory chain = getChain("goerli");
        uint256 forkId = vm.createFork(chain.rpcUrl);
        require(forkId == 0, "Chains expected forkId 0");
    }

    function selectChain(string memory chainAlias) internal {
        Chain memory chain = getChain(chainAlias);
        uint256 forkId = forkIdForChainId[chain.chainId];
        if (forkId == 0) {
            forkId = vm.createFork(chain.rpcUrl);
            forkIdForChainId[chain.chainId] = forkId;
        }
        vm.selectFork(forkId);
    }

    function selectChain(uint256 chainId) internal {
        Chain memory chain = getChain(chainId);
        console.log("chain", chain.chainId, chain.rpcUrl);
        uint256 forkId = forkIdForChainId[chain.chainId];
        if (forkId == 0) {
            forkId = vm.createFork(chain.rpcUrl);
            forkIdForChainId[chain.chainId] = forkId;
        }
        vm.selectFork(forkId);
    }
}