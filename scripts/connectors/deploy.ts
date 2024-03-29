import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import getSigners from '../../utils/getSigners'
import logContractDeployed from '../../utils/logContractDeployed'
import logDeployment from '../../utils/logDeployment'
import getMessengerDeployment from '../messenger/utils/getDeployment'

const MESSENGER_CONFIG_DIR = '../messenger/deployments'

async function deploy(fileName?: string) {
  console.log(`
######################################################
############# Deploy Connector Contracts #############
######################################################
  `)
  const hubChainId = '5'
  const spokeChainId = '420'

  const contracts: any = {
    connectorFactories: {}
  }

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { dispatchers, executors } = getMessengerDeployment(fileName)

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

  await logDeployment(`${__dirname}/..`, contracts, fileName)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default deploy