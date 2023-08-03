import { ethers } from 'hardhat'
import getSigners from '@hop-protocol/shared-utils/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared-utils/utils/logContractDeployed'
import logDeployment from '@hop-protocol/shared-utils/utils/logDeployment'
import { deployConfig } from './config'
import getTransporterDeployment from '@hop-protocol/transporter/utils/getDeployment'

async function deploy(fileName?: string) {
  console.log(`
######################################################
############# Deploy Messenger Contracts #############
######################################################
  `)

  const spokeChain = '420'
  const hubChainId = '5'

  let contracts: any = {
    executors: {},
    dispatchers: {}
  }

  const { transporters } = await getTransporterDeployment(fileName)
  const hubTransporterAddress = transporters[hubChainId]
  const spokeTransporterAddress = transporters[spokeChain]

  const Dispatcher = await ethers.getContractFactory('Dispatcher')
  const ExecutorManager = await ethers.getContractFactory('ExecutorManager')

  const { hubSigner, spokeSigners } = getSigners()

  const hubRoute = {
    chainId: await hubSigner.getChainId(),
    messageFee: deployConfig.messageFee,
    maxBundleMessages: deployConfig.maxBundleMessages
  }

  const spokeRoutes = [{
    chainId: await spokeSigners[0].getChainId(),
    messageFee: deployConfig.messageFee,
    maxBundleMessages: deployConfig.maxBundleMessages
  }]

  const hubDispatcher = await Dispatcher.connect(hubSigner).deploy(
    hubTransporterAddress,
    spokeRoutes
  )
  contracts.dispatchers[hubChainId] = hubDispatcher.address
  await logContractDeployed('Dispatcher', hubDispatcher)

  const HubTransporter = await ethers.getContractFactory('HubTransporter')
  const hubTransporter = await HubTransporter.connect(hubSigner).attach(hubTransporterAddress)
  await hubTransporter.setDispatcher(hubDispatcher.address)
  console.log('HubTransporter dispatcher set')

  const hubExecutor = await ExecutorManager.connect(hubSigner).deploy(hubTransporterAddress)
  contracts.executors[hubChainId] = hubExecutor.address
  await logContractDeployed('ExecutorManager', hubExecutor)

  const spokeDispatchers = []
  const spokeExecutors = []
  for (let i = 0; i < spokeSigners.length; i++) {
    const spokeSigner = spokeSigners[i]

    const spokeDispatcher = await Dispatcher.connect(spokeSigner).deploy(
      spokeTransporterAddress,
      [hubRoute]
    )
    contracts.dispatchers[spokeChain] = spokeDispatcher.address
    await logContractDeployed('Dispatcher', spokeDispatcher)
    spokeDispatchers.push(spokeDispatcher)

    const SpokeTransporter = await ethers.getContractFactory('SpokeTransporter')
    const spokeTransporter = await SpokeTransporter.connect(spokeSigner).attach(spokeTransporterAddress)
    const tx = await spokeTransporter.setDispatcher(spokeDispatcher.address)
    await tx.wait()
    console.log('SpokeTransporter dispatcher set')

    const spokeExecutor = await ExecutorManager.connect(spokeSigner).deploy(spokeTransporterAddress)
    contracts.executors[spokeChain] = spokeExecutor.address
    await logContractDeployed('ExecutorManager', spokeExecutor)
    spokeExecutors.push(spokeExecutor)

    await logDeployment(`${__dirname}/..`, contracts, fileName)
  }
}

export default deploy
