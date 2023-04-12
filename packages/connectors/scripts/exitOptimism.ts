import { CrossChainMessenger, MessageStatus } from '@eth-optimism/sdk'
import { ethers } from 'hardhat'
import { getSigners } from '../utils'

const txHash = '0x553b826ccb4de23b3f19a8badffa5914500bf3a09c3c2856d842e8b7eb647faa'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const crossChainMessenger = new CrossChainMessenger({
    l1ChainId: 5,
    l2ChainId: 420,
    l1SignerOrProvider: hubSigner,
    l2SignerOrProvider: spokeSigner,
    bedrock: true,
  })

  let messageStatus = await crossChainMessenger.getMessageStatus(txHash)
  console.log('Message status:', MessageStatus[messageStatus])

  while (
    messageStatus !== MessageStatus.READY_TO_PROVE &&
    messageStatus !== MessageStatus.READY_FOR_RELAY
  ) {
    await new Promise(resolve => setTimeout(resolve, 10_000))
    messageStatus = await crossChainMessenger.getMessageStatus(txHash)
    console.log('Message status:', MessageStatus[messageStatus])
  }

  if (messageStatus == MessageStatus.READY_TO_PROVE) {
    const proveTx = await crossChainMessenger.proveMessage(txHash)
    const proveRcpt = await proveTx.wait()
    console.log('Message proved: ', proveRcpt.transactionHash)
  }

  while (messageStatus !== MessageStatus.READY_FOR_RELAY) {
    await new Promise(resolve => setTimeout(resolve, 10_000))
    messageStatus = await crossChainMessenger.getMessageStatus(txHash)
    console.log('Message status:', MessageStatus[messageStatus])
  }

  const relayTx = await crossChainMessenger.finalizeMessage(txHash)
  const relayRcpt = await relayTx.wait()
  console.log('Message relayed: ', relayRcpt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
