import { ethers } from 'hardhat'
import getSigners from '../../utils/getSigners'
import logDeployment from '../../utils/logDeployment'
import logContractDeployed from '../../utils/logContractDeployed'
import getMessengerDeployment from '../messenger/utils/getDeployment'
import getConnectorDeployment from '../connectors/utils/getDeployment'

async function deploy(fileName?: string) {
  console.log(`
  ######################################################
  ############### Deploy Alias Contracts ###############
  ######################################################
    `)
  const contracts: any = {
    aliasFactories: {}
  }
  const hubChainId = '5'
  const spokeChainId = '420'

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { dispatchers, executors } = getMessengerDeployment(fileName)
  const { connectorFactories } = getConnectorDeployment(fileName)

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
  contracts.aliasFactories[hubChainId] = hubAliasFactory.address
  await logContractDeployed('AliasFactory', hubAliasFactory)

  const spokeAliasFactory = await AliasFactory.connect(spokeSigner).deploy(
    spokeDispatcherAddress,
    spokeExecutorAddress
  )
  contracts.aliasFactories[spokeChainId] = spokeAliasFactory.address
  await logContractDeployed('AliasFactory', spokeAliasFactory)

  // Deploy deployer on hub chain
  const aliasDeployer = await AliasDeployer.connect(hubSigner).deploy()
  contracts.aliasDeployer = aliasDeployer.address
  await logContractDeployed('AliasDeployer', aliasDeployer)

  await wait(5000)

  // Connect factories to deployer
  let tx = await aliasDeployer.setAliasFactoryForChainId(hubChainId, hubAliasFactory.address)
  await tx.wait()
  console.log('aliasDeployer hub AliasFactory set')

  const connectorAddress = await hubConnectorFactory.calculateAddress(hubChainId, aliasDeployer.address, spokeChainId, spokeAliasFactory.address)
  const messageFee = await hubConnectorFactory.getFee([hubChainId, spokeChainId])
  tx = await hubConnectorFactory.deployConnectors(hubChainId, aliasDeployer.address, spokeChainId, spokeAliasFactory.address, { value: messageFee, gasLimit: 5000000 })
  await tx.wait()
  console.log(`Connectors deployed: `, connectorAddress)
  tx = await aliasDeployer.setAliasFactoryForChainId(spokeChainId, connectorAddress)
  await tx.wait()
  console.log('aliasDeployer spoke AliasFactory set')

  await logDeployment(`${__dirname}/..`, contracts, fileName)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default deploy
