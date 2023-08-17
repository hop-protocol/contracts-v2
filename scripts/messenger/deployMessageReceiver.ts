import { ethers } from 'hardhat'
import getSigners from '../../utils/getSigners'
import logContractDeployed from '../../utils/logContractDeployed'
import { contracts } from './config'
const { messengers } = contracts.testnet

// ToDo: Move to utils
async function main() {
  const { hubSigner } = getSigners()
  let MockMessageReceiver = await ethers.getContractFactory(
    'MockMessageReceiver'
  )
  MockMessageReceiver = MockMessageReceiver.connect(hubSigner)
  const messengerAddress = messengers[await hubSigner.getChainId()]
  const tx = await MockMessageReceiver.deploy(messengerAddress)
  logContractDeployed('MockMessageReceiver', tx)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
