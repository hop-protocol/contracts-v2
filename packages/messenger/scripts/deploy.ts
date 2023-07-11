import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { contracts, deployConfig } from './config'
import deployTransporters from './deployTransporters'
import writeJson from '../utils/writeJSON'

async function main() {
  let contracts: any = {}

  const { hubTransporter, spokeTransporters } = await deployTransporters()
  contracts.hubTransporter = hubTransporter.address
  contracts.spokeTransporters = spokeTransporters.map(t => t.address)

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
  contracts.hubDispatcher = hubDispatcher.address
  await logContractDeployed('Dispatcher', hubDispatcher)
  const hubExecutor = await ExecutorManger.connect(hubSigner).deploy(hubTransporter.address)
  contracts.hubExecutor = hubExecutor.address
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
    contracts.spokeDispatcher = spokeDispatcher.address
    await logContractDeployed('Dispatcher', spokeDispatcher)
    spokeDispatchers.push(spokeDispatcher)

    const spokeExecutor = await ExecutorManger.connect(spokeSigner).deploy(spokeTransporter.address)
    contracts.spokeExecutor = spokeExecutor.address
    await logContractDeployed('ExecutorManager', spokeExecutor)
    spokeExecutors.push(spokeExecutor)

    let unixTimestamp = Math.floor(Date.now() / 1000);
    writeJson(contracts, `deployment-artifacts/${unixTimestamp}.json`)
  }


}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
