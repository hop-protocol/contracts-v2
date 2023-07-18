import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import getSigners from '@hop-protocol/shared/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared/utils/logContractDeployed'
import logDeployment from '@hop-protocol/shared/utils/logDeployment'
import getMessengerDeployment from '@hop-protocol/messenger/utils/getDeployment'

const MESSENGER_CONFIG_DIR = '@hop-protocol/messenger/deployments'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const contracts: any = {
    connectorFactories: {}
  }

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { dispatchers, executors } = getMessengerDeployment()

  const hubDispatcherAddress = dispatchers[hubChainId]
  const spokeDispatcherAddress = dispatchers[spokeChainId]
  const hubExecutorAddress = executors[hubChainId]
  const spokeExecutorAddress = executors[spokeChainId]

  // Deploy factories
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )
  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).deploy(hubDispatcherAddress, hubExecutorAddress)
  contracts.connectorFactories[hubChainId] = hubConnectorFactory.address
  await logContractDeployed('HubERC5164ConnectorFactory', hubConnectorFactory)

  const ERC5164ConnectorFactory = await ethers.getContractFactory(
    'ERC5164ConnectorFactory'
  )
  const spokeConnectorFactory = await ERC5164ConnectorFactory.connect(
    spokeSigner
  ).deploy(spokeDispatcherAddress, spokeExecutorAddress)
  contracts.connectorFactories[spokeChainId] = spokeConnectorFactory.address
  await logContractDeployed('ERC5164ConnectorFactory', spokeConnectorFactory)

  logDeployment(contracts)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
