import { ethers } from 'hardhat'
import { getSigners, getSetResultCalldata } from '../utils'
import { coreMessengerAddresses } from './config'

async function main() {
  const { hubSigner } = getSigners()

  const bundleId =
    '0x67828efe977de865e3a6315b092ec6b10f5e0e149b7f3d43fbeaee953fa04f62'
  const treeIndex = 0
  const siblings: string[] = [
    '0x07179261de5ae34af8281b9b73e5ed2aadb3ef14bad7e01a16cf8b643d51ea82',
  ]
  const totalLeaves = 2

  const fromChainId = 420
  const toChainId = 5
  const result = 999
  const data = await getSetResultCalldata(result)
  const messageReceiverAddress = '0x7B258c793CdbC3567B6727a2Ad8Bc7646d74c55C'
  const messageBridgeAddress = coreMessengerAddresses[toChainId]
  console.log('messageBridgeAddress', messageBridgeAddress)
  let messageBridge = await ethers.getContractAt(
    'HubMessageBridge',
    messageBridgeAddress
  )
  messageBridge = messageBridge.connect(hubSigner)

  console.log(fromChainId, hubSigner.address, messageReceiverAddress, data, {
    bundleId,
    treeIndex,
    siblings,
    totalLeaves,
  })

  const tx = await messageBridge.relayMessage(
    fromChainId,
    hubSigner.address,
    messageReceiverAddress,
    data,
    {
      bundleId,
      treeIndex,
      siblings,
      totalLeaves,
    }
  )
  // 420
  // 0xba1B44e7a4AF49eefef4d808994Ca0A7e1563F7B
  // 0x0000000000000000000000000000000000000009
  // 0x812448a500000000000000000000000000000000000000000000000000000000000003e7
  // {
  //   bundleId: '',
  //   treeIndex: 0,
  //   siblings: [
  //     '0x1d3d339512819f9b54b4574ca3c388eb2de91da9a7c773e73a6fc5ec02f31e25'
  //   ],
  //   totalLeaves: 2
  // }

  const receipt = await tx.wait()

  console.log('relayMessage', receipt.transactionHash)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
