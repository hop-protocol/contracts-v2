import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import { coreMessengerAddresses, messageConfig } from './config'

async function main() {
  for (let i = 0; i < 8; i++) {
    await sendMessage()
  }
}

async function sendMessage() {
  const { message } = messageConfig
  const { fromChainId, toChainId, to, result } = message

  const { signers } = getSigners()
  const signer = signers[message.fromChainId]

  const messageBridgeAddress = coreMessengerAddresses[fromChainId]
  const messageBridge = (
    await ethers.getContractAt('SpokeMessageBridge', messageBridgeAddress)
  ).connect(signer)
  const data = await getSetResultCalldata(result)

  const tx = await messageBridge.sendMessage(toChainId, to, data, {
    gasLimit: 5000000,
    value: '1000000000000',
  })

  const receipt = await tx.wait()
  console.log('messageSent', receipt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
