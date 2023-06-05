import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { contracts, deployConfig } from './config'
import deployTransporters from './deployTransporters'

async function main() {
  const { hubTransporter, spokeTransporters } = await deployTransporters()

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
  await logContractDeployed('Dispatcher', hubDispatcher)
  const hubExecutor = await ExecutorManger.connect(hubSigner).deploy(hubTransporter.address)
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
    await logContractDeployed('Dispatcher', spokeDispatcher)
    const spokeExecutor = await ExecutorManger.connect(spokeSigner).deploy(spokeTransporter.address)
    await logContractDeployed('ExecutorManager', spokeExecutor)

    spokeDispatchers.push(spokeDispatcher)
    spokeExecutors.push(spokeExecutor)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
