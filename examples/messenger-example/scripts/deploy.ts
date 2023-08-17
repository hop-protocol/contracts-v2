import { ethers } from 'hardhat'
import getSigners from '@hop-protocol/shared-utils/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared-utils/utils/logContractDeployed'
import getMessengerDeployment from '@hop-protocol/messenger/utils/getDeployment'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { dispatchers, executors } = getMessengerDeployment()

  const hubDispatcherAddress = dispatchers[hubChainId]
  const spokeDispatcherAddress = dispatchers[spokeChainId]
  const hubExecutorAddress = executors[hubChainId]
  const spokeExecutorAddress = executors[spokeChainId]

  // Deploy Greeters on both chains
  const Greeter = await ethers.getContractFactory('Greeter')
  const greeter1 = await Greeter.connect(hubSigner).deploy(hubDispatcherAddress, hubExecutorAddress)
  await logContractDeployed('Greeter', greeter1)

  const greeter2 = await Greeter.connect(spokeSigner).deploy(spokeDispatcherAddress, spokeExecutorAddress)
  await logContractDeployed('Greeter', greeter2)

  console.log('Greeters deployed')
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
