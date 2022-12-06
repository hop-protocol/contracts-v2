import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import { coreMessengerAddresses } from './config'

async function main() {
  for (let i = 0; i < 8; i++) {
    await sendMessage()
  }
}

async function sendMessage() {
  const { hubSigner, spokeSigners } = getSigners()

  const fromChainId = 420
  const toChainId = 5
  const result = 999
  const spokeSigner = spokeSigners[0]
  const messageReceiverAddress = '0x7B258c793CdbC3567B6727a2Ad8Bc7646d74c55C'
  const messageBridgeAddress = coreMessengerAddresses[fromChainId]
  const messageBridge = (
    await ethers.getContractAt('SpokeMessageBridge', messageBridgeAddress)
  ).connect(spokeSigner)
  const data = await getSetResultCalldata(result)

  const routeData = await messageBridge.routeData(420)

  const tx = await messageBridge.sendMessage(
    toChainId,
    messageReceiverAddress,
    data,
    {
      gasLimit: 5000000,
      value: '1000000000000',
    }
  )
  // const tx = await messageBridge.setHubBridge(
  //   '0xf16d90c57c9810181d2fcbc8b150ecfa63fc9b1b',
  //   '0xb0e4a4a2fd045aa32befae04a568c56d685dfa1b',
  //   { gasLimit: 5000000 }
  // )

  const receipt = await tx.wait()
  console.log('messageSent', receipt.transactionHash)
  // sendMessage(uint256,address,bytes)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
