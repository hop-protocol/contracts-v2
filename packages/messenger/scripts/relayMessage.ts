import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import { contracts, messageConfig } from './config'
const { messengers } = contracts.testnet

async function main() {
  const {
    message: { fromChainId, toChainId, to, result },
    proof: { bundleNonce, treeIndex, siblings, totalLeaves },
  } = messageConfig

  const data = await getSetResultCalldata(result)
  const messageBridgeAddress = messengers[toChainId]
  let messageBridge = await ethers.getContractAt(
    'HubMessageBridge',
    messageBridgeAddress
  )

  const { signers } = getSigners()
  const signer = signers[fromChainId]
  messageBridge = messageBridge.connect(signer)

  const tx = await messageBridge.executeMessage(
    fromChainId,
    signer.address,
    to,
    data,
    {
      bundleNonce,
      treeIndex,
      siblings,
      totalLeaves,
    }
  )

  const receipt = await tx.wait()

  console.log('executeMessage', receipt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
