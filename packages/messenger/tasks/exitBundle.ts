import { task } from 'hardhat/config'
import * as sdk from '@eth-optimism/sdk'
import { getSigners } from '../utils'

task('exitBundle', 'Exit a bundle from L2 to L1')
  .addParam('hash', 'The hash of the message to exit')
  .setAction(async ({ hash }) => {
    const { hubSigner, spokeSigners } = getSigners()
    const spokeSigner = spokeSigners[0]

    const crossChainMessenger = new sdk.CrossChainMessenger({
      l1ChainId: 5,
      l2ChainId: 420,
      l1SignerOrProvider: hubSigner,
      l2SignerOrProvider: spokeSigner,
    })

    const messageStatus = await crossChainMessenger.getMessageStatus(hash)

    if (messageStatus == sdk.MessageStatus.READY_FOR_RELAY) {
      console.log('Ready for relay')
    } else {
      console.log('Not ready for relay')
    }

    const tx = await crossChainMessenger.finalizeMessage(hash)
    const receipt = await tx.wait()

    console.log('Bundle exited', receipt.transactionHash)
  })
