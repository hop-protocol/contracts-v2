
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;
import {Script} from "forge-std/Script.sol";

struct Chain {
    string name;
    uint256 chainId;
    string chainAlias;
    string rpcUrl;
}

contract CrossChainScript is Script {
    uint256 immutable private privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
    mapping(uint256 => uint256) public forkIdForChainId;
    uint256 public broadcastChainId;
    bool public crossChainBroadcastInProgress;

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
        require(forkId == 0, "Expected forkId 0");
    }

    modifier broadcastOn(uint256 chainId) {
        uint256 _cachedChainId = broadcastChainId;
        _on(chainId);
        _;
        if (_cachedChainId != 0) {
            _on(_cachedChainId);
        } else {
            vm.stopBroadcast();
            broadcastChainId = 0;
        }
    }

    modifier crossChainBroadcast() {
        crossChainBroadcastInProgress = true;
        _;
        if (broadcastChainId != 0) {
            vm.stopBroadcast();
            broadcastChainId = 0;
        }
    }

    function on(uint256 chainId) internal {
        require(crossChainBroadcastInProgress == true, "Not cross chain broadcasting");
        _on(chainId);
    }

    function on(string memory chainAlias) internal {
        require(crossChainBroadcastInProgress == true, "Not cross chain broadcasting");
        Chain memory chain = getChain(chainAlias);
        _on(chain.chainId);
    }

    function _on(uint256 chainId) private {
        if (broadcastChainId != 0) {
            vm.stopBroadcast();
            broadcastChainId = 0;
        }

        // if no fork exists, create a new fork
        uint256 forkId = forkIdForChainId[chainId];
        if (forkId == 0) {
            Chain memory chain = getChain(chainId);
            forkId = vm.createFork(chain.rpcUrl);
            forkIdForChainId[chain.chainId] = forkId;
        }

        vm.selectFork(forkId);
        vm.startBroadcast(privateKey);
        broadcastChainId = chainId;
    }
}