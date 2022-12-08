import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import { coreMessengerAddresses, relayMessageConfig } from './config'

async function main() {
  const { hubSigner } = getSigners()

  const {
    fromChainId,
    toChainId,
    to,
    proof: { bundleId, treeIndex, siblings, totalLeaves },
  } = relayMessageConfig
  const data = await getSetResultCalldata(relayMessageConfig.result)
  const messageBridgeAddress = coreMessengerAddresses[toChainId]
  let messageBridge = await ethers.getContractAt(
    'HubMessageBridge',
    messageBridgeAddress
  )
  messageBridge = messageBridge.connect(hubSigner)

  const tx = await messageBridge.relayMessage(
    fromChainId,
    hubSigner.address,
    to,
    data,
    {
      bundleId,
      treeIndex,
      siblings,
      totalLeaves,
    }
  )

  const receipt = await tx.wait()

  console.log('relayMessage', receipt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
