import { Contract, Signer} from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
const { parseUnits } = ethers.utils
import { contracts, deployConfig } from './config'
import {
  EXIT_TIME,
  RELAY_WINDOW,
  ABSOLUTE_MAX_FEE,
  MAX_FEE_BPS
} from './constants'
const { externalContracts } = contracts.testnet

async function deployTransporters() {
  const HubTransporter = await ethers.getContractFactory('HubTransporter')
  const SpokeTransporter = await ethers.getContractFactory('SpokeTransporter')

  const { hubSigner, spokeSigners } = getSigners()
  
  const hubTransporter = await HubTransporter.connect(hubSigner).deploy(
    RELAY_WINDOW,
    ABSOLUTE_MAX_FEE,
    MAX_FEE_BPS
  )
  
  await logContractDeployed('HubTransporter', hubTransporter)

  const spokeTransporters = []
  for (let i = 0; i < spokeSigners.length; i++) {
    const spokeSigner = spokeSigners[i]
    const hubChainId = await hubSigner.getChainId()
    const spokeChainId = await spokeSigner.getChainId()
    const spokeTransporter = await SpokeTransporter.connect(
      spokeSigner
    ).deploy(hubChainId, 0)

    await logContractDeployed('SpokeTransporter', spokeTransporter)

    spokeTransporters.push(spokeTransporter)

    const { l1Connector, l2Connector } = await deployConnectors(
      hubTransporter.address,
      spokeTransporter.address,
      hubSigner,
      spokeSigner
    )

    console.log('Connecting bridges...')
    await hubTransporter.setSpokeConnector(
      spokeChainId,
      l1Connector.address,
      EXIT_TIME
    )

    await spokeTransporter.setHubConnector(l2Connector.address, { gasLimit: 5000000 })
    console.log('Hub and Spoke bridge connected')
  }

  return { hubTransporter, spokeTransporters }
}

async function deployConnectors(
  l1Target: string,
  l2Target: string,
  l1Signer: Signer,
  l2Signer: Signer
) {
  console.log('Deploying connectors...')
  const L1OptimismConnector = await ethers.getContractFactory(
    'L1OptimismConnector'
  )
  const L2OptimismConnector = await ethers.getContractFactory(
    'L2OptimismConnector'
  )

  const l1Connector = await L1OptimismConnector.connect(l1Signer).deploy(
    externalContracts.optimism.l1CrossDomainMessenger,
    500_000,
    { gasLimit: 5_000_000 }
  )

  await logContractDeployed('L1Connector', l1Connector)

  const l2Connector = await L2OptimismConnector.connect(l2Signer).deploy(
    externalContracts.optimism.l2CrossDomainMessenger,
    500_000,
    { gasLimit: 5_000_000 }
  )

  await logContractDeployed('L2Connector', l2Connector)

  console.log('Connecting L1Connector and L2Connector...')
  await l1Connector
    .connect(l1Signer)
    .initialize(l1Target, l2Connector.address, { gasLimit: 5000000 })
  await l2Connector
    .connect(l2Signer)
    .initialize(l2Target, l1Connector.address, { gasLimit: 5000000 })

  console.log('L1Connector and L2Connector connected')

  return {
    l1Connector,
    l2Connector,
  }
}

export default deployTransporters
