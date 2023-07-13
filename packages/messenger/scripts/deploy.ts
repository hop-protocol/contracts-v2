import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { contracts, deployConfig } from './config'
import deployTransporters from './deployTransporters'
import logDeployment from '../utils/logDeployment'

async function main() {
  const spokeChain = '420'
  const hubChainId = '5'

  let contracts: any = {
    transporters: {},
    executors: {},
    dispatchers: {}
  }

  const { hubTransporter, spokeTransporters } = await deployTransporters()
  contracts.transporters[hubChainId] = hubTransporter.address
  contracts.transporters[spokeChain] = spokeTransporters[0].address

  const Dispatcher = await ethers.getContractFactory('Dispatcher')
  const ExecutorManger = await ethers.getContractFactory('ExecutorManager')

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
    hubTransporter.address,
    spokeRoutes
  )
  contracts.dispatchers[hubChainId] = hubDispatcher.address
  await logContractDeployed('Dispatcher', hubDispatcher)

  await hubTransporter.setDispatcher(hubDispatcher.address)
  console.log('HubTransporter dispatcher set')

  const hubExecutor = await ExecutorManger.connect(hubSigner).deploy(hubTransporter.address)
  contracts.executors[hubChainId] = hubExecutor.address
  await logContractDeployed('ExecutorManager', hubExecutor)

  const spokeDispatchers = []
  const spokeExecutors = []
  for (let i = 0; i < spokeSigners.length; i++) {
    const spokeSigner = spokeSigners[i]

    const spokeTransporter = spokeTransporters[i]
    const spokeDispatcher = await Dispatcher.connect(spokeSigner).deploy(
      spokeTransporter.address,
      [hubRoute]
    )
    contracts.dispatchers[spokeChain] = spokeDispatcher.address
    await logContractDeployed('Dispatcher', spokeDispatcher)
    spokeDispatchers.push(spokeDispatcher)

    await spokeTransporter.setDispatcher(spokeDispatcher.address)
    console.log('SpokeTransporter dispatcher set')

    const spokeExecutor = await ExecutorManger.connect(spokeSigner).deploy(spokeTransporter.address)
    contracts.executors[spokeChain] = spokeExecutor.address
    await logContractDeployed('ExecutorManager', spokeExecutor)
    spokeExecutors.push(spokeExecutor)

    logDeployment(contracts)
  }


}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
