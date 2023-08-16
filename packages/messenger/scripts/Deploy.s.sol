// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Dispatcher, Route} from "@hop-protocol/messenger/contracts/messenger/Dispatcher.sol";
import {ExecutorManager} from "@hop-protocol/messenger/contracts/messenger/ExecutorManager.sol";

import {
    HUB_CHAIN_ID,
    SPOKE_CHAIN_ID_0,
    SPOKE_CHAIN_ID_1,
    MESSAGE_FEE,
    MAX_BUNDLE_MESSAGES
} from "@hop-protocol/shared-solidity/test/foundry/Constants.sol";
import {ExternalContracts, OPStackConfig} from "@hop-protocol/shared-solidity/test/foundry/ExternalContracts.sol";
import {CrossChainScript, Chain} from "@hop-protocol/shared-solidity/test/foundry/CrossChainScript.sol";
import {TransporterFixture} from "@hop-protocol/transporter/scripts/Deploy.s.sol";
import {ITransportLayer} from "../contracts/interfaces/ITransportLayer.sol";

contract MessengerFixture is Script, CrossChainScript {
    TransporterFixture public transporterFixture;
    Route[] public routes = [
        Route(
            HUB_CHAIN_ID,
            SafeCast.toUint128(MESSAGE_FEE),
            SafeCast.toUint128(MAX_BUNDLE_MESSAGES)
        ),
        Route(
            SPOKE_CHAIN_ID_0,
            SafeCast.toUint128(MESSAGE_FEE),
            SafeCast.toUint128(MAX_BUNDLE_MESSAGES)
        ),
        Route(
            SPOKE_CHAIN_ID_1,
            SafeCast.toUint128(MESSAGE_FEE),
            SafeCast.toUint128(MAX_BUNDLE_MESSAGES)
        )
    ];

    function run() public {
        transporterFixture = new TransporterFixture();
        transporterFixture.run();

        uint256[] memory _chainIds = new uint256[](3);
        _chainIds[0] = HUB_CHAIN_ID;
        _chainIds[1] = SPOKE_CHAIN_ID_0;
        _chainIds[2] = SPOKE_CHAIN_ID_1;
        deploy(_chainIds);
    }

    function deploy(uint256[] memory _chainIds) public crossChainBroadcast {
        for(uint256 i = 0; i < _chainIds.length; i++) {
            uint256 _chainId = _chainIds[i];
            on(_chainId);
            ITransportLayer transporter = transporterFixture.transporters(_chainId);
            Dispatcher dispatcher = new Dispatcher(
                address(transporter), 
                routes
            );
            
        }
    }

    // function deployHub(uint256 _hubChainId) public broadcastOn(_hubChainId) {
    //     console.log("Deploying hub");
    //     hubTransporter = new HubTransporter(
    //         RELAY_WINDOW,
    //         MAX_TRANSPORT_FEE_ABSOLUTE,
    //         MAX_TRANSPORT_FEE_BPS
    //     );
    //     console.log("HubTransporter", address(hubTransporter));

    //     transporters[_hubChainId] = Transporter(address(hubTransporter));
    // }

    // function deploySpoke(uint256 _hubChainId, uint256 spokeChainId) public broadcastOn(spokeChainId) {
    //     console.log("Deploying spoke", spokeChainId);
    //     SpokeTransporter spokeTransporter = new SpokeTransporter(_hubChainId, FULL_POOL_SIZE);
    //     transporters[spokeChainId] = spokeTransporter;
    //     spokeTransporters.push(spokeTransporter);
    //     console.log("SpokeTransporter", address(spokeTransporter));
    // }

    // function deployConnectors(
    //     uint256 _hubChainId,
    //     uint256 spokeChainId,
    //     address hubTarget,
    //     address spokeTarget
    // )
    //     public
    //     crossChainBroadcast
    // {
    //     OPStackConfig memory opStackConfig = ExternalContracts.getOpStackConfig(spokeChainId);
    //     console.log("Deploying OP Stack connectors", spokeChainId, _hubChainId);

    //     on(_hubChainId);
    //     L1OptimismConnector l1OptimismConnector = new L1OptimismConnector(
    //         opStackConfig.l1CrossDomainMessenger,
    //         opStackConfig.defaultGasLimit
    //     );
    //     console.log("L1OptimismConnector", address(l1OptimismConnector));

    //     on(spokeChainId);
    //     L2OptimismConnector l2OptimismConnector = new L2OptimismConnector(
    //         opStackConfig.l2CrossDomainMessenger,
    //         opStackConfig.defaultGasLimit
    //     );
    //     console.log("L2OptimismConnector", address(l2OptimismConnector));

    //     on(_hubChainId);
    //     l1OptimismConnector.initialize(hubTarget, address(l2OptimismConnector));

    //     on(spokeChainId);
    //     l2OptimismConnector.initialize(spokeTarget, address(l1OptimismConnector));
    //     console.log("Connectors initialized");

    //     // Save addresses to state
    //     hubConnectors[spokeChainId] = address(l1OptimismConnector);
    //     spokeConnectors[spokeChainId] = address(l2OptimismConnector);
    // }
}
