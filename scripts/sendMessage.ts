import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import {
  coreMessengerAddresses,
  deployConfig,
  messageConfig,
  txConfig,
} from './config'

async function main() {
  const { maxBundleMessages } = deployConfig
  for (let i = 0; i < maxBundleMessages; i++) {
    await sendMessage()
  }
}

async function sendMessage() {
  const { message } = messageConfig
  const { fromChainId, toChainId, to, result } = message
  const { messageFee } = deployConfig
  const { gasLimit } = txConfig

  const { signers } = getSigners()
  const signer = signers[message.fromChainId]

  const messageBridgeAddress = coreMessengerAddresses[fromChainId]
  const messageBridge = (
    await ethers.getContractAt('SpokeMessageBridge', messageBridgeAddress)
  ).connect(signer)
  const data = await getSetResultCalldata(result)

  const tx = await messageBridge.sendMessage(toChainId, to, data, {
    gasLimit: gasLimit,
    value: messageFee,
  })

  const receipt = await tx.wait()
  console.log('messageSent', receipt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
