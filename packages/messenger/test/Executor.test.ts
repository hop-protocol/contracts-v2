import { expect } from 'chai'
import { BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import getSetResultCalldata from '../../shared/utils/getSetResultCalldata'
import {
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  MAX_BUNDLE_MESSAGES,
} from './constants'
import Fixture, { MessageSentEvent } from './fixture'
import type { MockMessageReceiver as IMessageReceiver } from '../typechain'

describe('Executor', function () {
  describe('executeMessage', function () {
    it('should handle a reverted message', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID
      const [sender] = await ethers.getSigners()

      const deployment = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )
      const fixture = deployment.fixture

      const { messageBundled } = await fixture.dispatchMessage(
        sender,
        { data: '0xdeadbeef' }
      )

      const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
      await fixture.dispatchMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted } = await fixture.dispatchMessage(sender)
      if (!bundleCommitted || !bundleCommitted?.bundleNonce) {
        throw new Error('No bundleCommitted event')
      }

      const executor = fixture.executors[toChainId.toString()]
      if (!messageBundled) throw new Error('No messageBundled event')
      const isSpent = await executor.isMessageSpent(
        messageBundled.bundleNonce,
        messageBundled.treeIndex
      )
      expect(isSpent).to.be.false
    })

    describe('with standard setup', function () {
      let fixture: Fixture
      let bundleNonce: string
      let messageSent: MessageSentEvent

      beforeEach(async function () {
        const fromChainId = SPOKE_CHAIN_ID_0
        const toChainId = HUB_CHAIN_ID
        const [sender] = await ethers.getSigners()

        const deployment = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
          { fromChainId, toChainId }
        )
        fixture = deployment.fixture

        const dispatchMessageEvents = await fixture.dispatchMessage(sender)
        messageSent = dispatchMessageEvents?.messageSent

        const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
        await fixture.dispatchMessageRepeat(numFillerMessages, sender)

        const { bundleCommitted } = await fixture.dispatchMessage(sender)
        if (!bundleCommitted || !bundleCommitted?.bundleNonce) {
          throw new Error('No bundleCommitted event')
        }
        bundleNonce = bundleCommitted.bundleNonce
      })

      it('should not allow invalid fromChainId', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            fromChainId: SPOKE_CHAIN_ID_1,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow invalid from', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            from: '0x0000000000000000000000000000000000000099',
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow invalid to', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            to: '0x0000000000000000000000000000000000000098',
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow invalid message data', async function () {
        const invalidData = await getSetResultCalldata(2831082398)
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            data: invalidData,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      // BundleProof
      it('should not allow invalid bundleNonce', async function () {
        const invalidBundleNonce =
          '0x0123456789012345678901234567890123456789012345678901234567891234'
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            bundleNonce: invalidBundleNonce,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow invalid treeIndex', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            treeIndex: 1,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow invalid proof', async function () {
        const messageId = messageSent.messageId
        const wrongMessageId = fixture.bundles[bundleNonce].messageIds[1]
        const wrongProof = fixture.getProof(wrongMessageId)
        await expect(
          fixture.executeMessage(messageId, {
            siblings: wrongProof,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow extra siblings', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleNonce].messageIds.length + 1
        const proof = fixture.getProof(messageId)
        proof.push(proof[proof.length - 1])
        await expect(
          fixture.executeMessage(messageId, {
            siblings: proof,
            totalLeaves,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow empty proof for non single element tree', async function () {
        const messageId = messageSent.messageId
        await expect(
          fixture.executeMessage(messageId, {
            siblings: [],
            totalLeaves: 1,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow totalLeaves + 1', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleNonce].messageIds.length + 1
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves,
          })
        ).to.be.revertedWith(
          'MerkleTreeLib: Total siblings does not correctly correspond to total leaves.'
        )
      })

      it('should not allow totalLeaves / 2', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleNonce].messageIds.length / 2
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves,
          })
        ).to.be.revertedWith(
          'MerkleTreeLib: Total siblings does not correctly correspond to total leaves.'
        )
      })

      it('should not allow 0 totalLeaves', async function () {
        const messageId = messageSent.messageId
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves: 0,
          })
        ).to.be.revertedWith('MerkleTreeLib: Total leaves must be greater than zero.')
      })

      it('should not allow just root as sibling', async function () {
        const messageId = messageSent.messageId
        const root = fixture.getBundle(messageId).bundleRoot
        await expect(
          fixture.executeMessage(messageId, {
            siblings: [root],
            totalLeaves: 2,
          })
        ).to.be.revertedWith('InvalidBundle')
      })

      it('should not allow the same message to be relayed twice', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleNonce].messageIds.length + 1
        const proof = fixture.getProof(messageId)
        proof.push(proof[proof.length - 1])
        await expect(
          fixture.executeMessage(messageId, {
            siblings: proof,
            totalLeaves,
          })
        ).to.be.revertedWith('InvalidBundle')
      })
    })

    describe('getChainId', function () {
      it('should return the chainId', async function () {
        const fromChainId = SPOKE_CHAIN_ID_0
        const toChainId = HUB_CHAIN_ID
  
        const { fixture } = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
          { fromChainId, toChainId }
        )
  
        const executor = fixture.executors[HUB_CHAIN_ID.toString()]
        const chainId = await executor.getChainId()
        expect(chainId).to.eq(HUB_CHAIN_ID)
      })
    })
  })

  describe('getChainId', function () {
    it('should return the chainId', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID

      const { fixture } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      const executor = fixture.executors[HUB_CHAIN_ID.toString()]
      const chainId = await executor.getChainId()
      expect(chainId).to.eq(HUB_CHAIN_ID)
    })
  })
})

async function expectMessageReceiverState(
  messageReceiver: IMessageReceiver,
  result: BigNumberish,
  msgSender: string,
  xDomainSender: string,
  xDomainChainId: BigNumberish
) {
  const _result = await messageReceiver.result()
  const _msgSender = await messageReceiver.msgSender()
  const _xDomainSender = await messageReceiver.xDomainSender()
  const _xDomainChainId = await messageReceiver.xDomainChainId()

  expect(result).to.eq(_result)
  expect(msgSender).to.eq(_msgSender)
  expect(xDomainSender).to.eq(_xDomainSender)
  expect(xDomainChainId).to.eq(_xDomainChainId)
}
