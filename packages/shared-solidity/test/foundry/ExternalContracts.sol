// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;
import {console} from "forge-std/Console.sol";

struct OPStackConfig {
    address l1CrossDomainMessenger;
    address l2CrossDomainMessenger;
    uint256 defaultGasLimit;
}

library ExternalContracts {
    function getOpStackConfig(uint256 chainId) internal view returns (OPStackConfig memory) {
        if (chainId == 420) {
            return OPStackConfig(
                0x5086d1eEF304eb5284A0f6720f79403b4e9bE294,
                0x4200000000000000000000000000000000000007,
                200_000
            );
        } else if (chainId == 84531) {
            return OPStackConfig(
                0x8e5693140eA606bcEB98761d9beB1BC87383706D,
                0x4200000000000000000000000000000000000007,
                200_000
            );
        }

        console.log("No OPStackConfig for chainId", chainId);
        revert("No OPStackConfig for chainId");
    }
}

