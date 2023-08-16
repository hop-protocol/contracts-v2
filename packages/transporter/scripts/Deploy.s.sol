// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";
import {MockConnector} from "@hop-protocol/connectors/contracts/test/MockConnector.sol";
import {L1OptimismConnector} from "@hop-protocol/connectors/contracts/external/L1OptimismConnector.sol";
import {L2OptimismConnector} from "@hop-protocol/connectors/contracts/external/L2OptimismConnector.sol";

import {
    RELAY_WINDOW,
    MAX_TRANSPORT_FEE_ABSOLUTE,
    MAX_TRANSPORT_FEE_BPS,
    HUB_CHAIN_ID,
    SPOKE_CHAIN_ID_0,
    SPOKE_CHAIN_ID_1,
    FULL_POOL_SIZE
} from "@hop-protocol/shared-solidity/test/foundry/Constants.sol";
import {ExternalContracts, OPStackConfig} from "@hop-protocol/shared-solidity/test/foundry/ExternalContracts.sol";
import {CrossChainScript, Chain} from "@hop-protocol/shared-solidity/test/foundry/CrossChainScript.sol";
import {Transporter} from "../contracts/Transporter.sol";
import {HubTransporter} from "../contracts/HubTransporter.sol";
import {SpokeTransporter} from  "../contracts/SpokeTransporter.sol";

contract TransporterFixture is Script, CrossChainScript {
    // Deployment
    uint256 public hubChainId;
    uint256[] public spokeChainIds;
    HubTransporter public hubTransporter;
    SpokeTransporter[] public spokeTransporters;
    mapping(uint256 => Transporter) public transporters;
    mapping(uint256 => address) public hubConnectors;
    mapping(uint256 => address) public spokeConnectors;

    function run() public {
        uint256[] memory _spokeChainIds = new uint256[](2);
        _spokeChainIds[0] = SPOKE_CHAIN_ID_0;
        _spokeChainIds[1] = SPOKE_CHAIN_ID_1;
        deploy(HUB_CHAIN_ID, _spokeChainIds);
    }

    function deploy(uint256 _hubChainId, uint256[] memory _spokeChainIds) public {
        hubChainId = _hubChainId;
        spokeChainIds = _spokeChainIds;

        console.log("Deploying contracts");
        deployHubTransporter(_hubChainId);

        for (uint256 i = 0; i < spokeChainIds.length; i++) {
            deploySpokeTransporter(_hubChainId, spokeChainIds[i]);
            deployConnectors(_hubChainId, spokeChainIds[i], address(hubTransporter), address(spokeTransporters[i]));
        }
    }

    function deployHubTransporter(uint256 _hubChainId) public broadcastOn(_hubChainId) {
        console.log("Deploying hub");
        hubTransporter = new HubTransporter(
            RELAY_WINDOW,
            MAX_TRANSPORT_FEE_ABSOLUTE,
            MAX_TRANSPORT_FEE_BPS
        );
        console.log("HubTransporter", address(hubTransporter));

        transporters[_hubChainId] = Transporter(address(hubTransporter));
    }

    function deploySpokeTransporter(uint256 _hubChainId, uint256 spokeChainId) public broadcastOn(spokeChainId) {
        console.log("Deploying spoke", spokeChainId);
        SpokeTransporter spokeTransporter = new SpokeTransporter(_hubChainId, FULL_POOL_SIZE);
        transporters[spokeChainId] = spokeTransporter;
        spokeTransporters.push(spokeTransporter);
        console.log("SpokeTransporter", address(spokeTransporter));
    }

    function deployConnectors(
        uint256 _hubChainId,
        uint256 spokeChainId,
        address hubTarget,
        address spokeTarget
    )
        public
        crossChainBroadcast
    {
        OPStackConfig memory opStackConfig = ExternalContracts.getOpStackConfig(spokeChainId);
        console.log("Deploying OP Stack connectors", spokeChainId, _hubChainId);

        on(_hubChainId);
        L1OptimismConnector l1OptimismConnector = new L1OptimismConnector(
            opStackConfig.l1CrossDomainMessenger,
            opStackConfig.defaultGasLimit
        );
        console.log("L1OptimismConnector", address(l1OptimismConnector));

        on(spokeChainId);
        L2OptimismConnector l2OptimismConnector = new L2OptimismConnector(
            opStackConfig.l2CrossDomainMessenger,
            opStackConfig.defaultGasLimit
        );
        console.log("L2OptimismConnector", address(l2OptimismConnector));

        on(_hubChainId);
        l1OptimismConnector.initialize(hubTarget, address(l2OptimismConnector));

        on(spokeChainId);
        l2OptimismConnector.initialize(spokeTarget, address(l1OptimismConnector));
        console.log("Connectors initialized");

        // Save addresses to state
        hubConnectors[spokeChainId] = address(l1OptimismConnector);
        spokeConnectors[spokeChainId] = address(l2OptimismConnector);
    }
}
