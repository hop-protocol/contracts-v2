import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../../utils'
import { dispatchers, executors, connectorFactories } from '../config'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const hubExecutorAddress = dispatchers[hubChainId]
  const hubDispatcherAddress = executors[hubChainId]
  const spokeExecutorAddress = dispatchers[spokeChainId]
  const spokeDispatcherAddress = executors[spokeChainId]
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
  await logContractDeployed('ERC5164ConnectorFactory', hubAliasDeployer)

  // Connect factories to deployer
  await hubAliasDeployer.setAliasFactoryForChainId(hubChainId, hubAliasFactory.address)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
