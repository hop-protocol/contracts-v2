import { Contract, Signer, ContractTransaction, BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
// import { dispatchers, executors, connectorFactories } from '../config'
import getMessengerDeployment from '@hop-protocol/messenger/utils/getDeployment'
import getConnectorDeployment from '@hop-protocol/connectors/utils/getDeployment'
import logDeployment from '../utils/logDeployment'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { dispatchers, executors } = getMessengerDeployment()
  const { connectorFactories } = getConnectorDeployment()

  const hubExecutorAddress = executors[hubChainId]
  const hubDispatcherAddress = dispatchers[hubChainId]
  const spokeExecutorAddress = executors[spokeChainId]
  const spokeDispatcherAddress = dispatchers[spokeChainId]
  const hubConnectorFactoryAddress = connectorFactories[hubChainId]

  // Deploy factories
  const AliasFactory = await ethers.getContractFactory('AliasFactory')
  const AliasDeployer = await ethers.getContractFactory('AliasDeployer')
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )

  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).attach(hubConnectorFactoryAddress)

  // Deploy alias factories on every chain
  const hubAliasFactory = await AliasFactory.connect(hubSigner).deploy(
    hubDispatcherAddress,
    hubExecutorAddress
  )
  await logContractDeployed('AliasFactory', hubAliasFactory)
  const spokeAliasFactory = await AliasFactory.connect(spokeSigner).deploy(
    spokeDispatcherAddress,
    spokeExecutorAddress
  )
  await logContractDeployed('AliasFactory', spokeAliasFactory)

  // Deploy deployer on hub chain
  const hubAliasDeployer = await AliasDeployer.connect(hubSigner).deploy()
  await logContractDeployed('AliasDeployer', hubAliasDeployer)

  await wait(5000)

  // Connect factories to deployer
  await hubAliasDeployer.setAliasFactoryForChainId(hubChainId, hubAliasFactory.address)

  const connectorAddress = await hubConnectorFactory.calculateAddress(hubChainId, hubAliasDeployer.address, spokeChainId, spokeAliasFactory.address)
  const messageFee = await hubConnectorFactory.getFee([hubChainId, spokeChainId])
  await hubConnectorFactory.deployConnectors(hubChainId, hubAliasDeployer.address, spokeChainId, spokeAliasFactory.address, { value: messageFee })
  console.log(`Connectors deployed: `, connectorAddress)
  await hubAliasDeployer.connect(hubSigner).setAliasFactoryForChainId(spokeChainId, connectorAddress)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
