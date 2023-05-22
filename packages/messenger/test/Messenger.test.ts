import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import {
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_RESULT,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
} from './constants'
const { provider } = ethers
import Fixture, { MessageSentEvent } from './fixtures/Messenger'
import { getSetResultCalldata } from '../utils'
import type { MockMessageReceiver as IMessageReceiver } from '../typechain'
import { keccak256, defaultAbiCoder } from 'ethers/lib/utils'

describe('Messenger', function () {
  describe('all routes should complete a full bundle', async function () {
    let fromChainId: BigNumber
    let toChainId: BigNumber

    it('should complete a Spoke to Hub bundle', async function () {
      fromChainId = SPOKE_CHAIN_ID_0
      toChainId = HUB_CHAIN_ID
    })

    it('should complete a Hub to Spoke bundle', async function () {
      fromChainId = HUB_CHAIN_ID
      toChainId = SPOKE_CHAIN_ID_0
    })

    it('should complete a Spoke to Spoke bundle', async function () {
      fromChainId = SPOKE_CHAIN_ID_0
      toChainId = SPOKE_CHAIN_ID_1
    })

    afterEach(async function () {
      const [sender] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [
          SPOKE_CHAIN_ID_0,
          SPOKE_CHAIN_ID_1,
        ],
        {
          toChainId,
          fromChainId
        }
      )

      const { messageSent, messageBundled } = await fixture.dispatchMessage(sender)

      const messageReceiver = fixture.getMessageReceiver()

      // MessageSent event
      expect(sender.address.toLowerCase()).to.eq(messageSent.from.toLowerCase())
      expect(toChainId).to.eq(messageSent.toChainId)
      expect(messageReceiver.address.toLowerCase()).to.eq(
        messageSent.to.toLowerCase()
      )
      expect(data.toString().toLowerCase()).to.eq(
        messageSent.data.toLowerCase()
      )

      const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
      await fixture.dispatchMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted, bundleProven } =
        await fixture.dispatchMessage(sender)
      if (!bundleCommitted) throw new Error('Bundle not committed')
      if (!bundleProven) throw new Error('Bundle not proven at destination')

      // BundleCommitted event
      const bundleId = bundleCommitted.bundleId
      const bundleRoot = bundleCommitted.bundleRoot
      const commitTime = bundleCommitted.commitTime
      const expectedFullBundleFee =
        BigNumber.from(MESSAGE_FEE).mul(MAX_BUNDLE_MESSAGES)
      expect(expectedFullBundleFee).to.eq(bundleCommitted.bundleFees)
      expect(toChainId).to.eq(bundleCommitted.toChainId)

      // BundleProven event
      expect(fromChainId).to.eq(bundleProven.fromChainId)
      expect(bundleId).to.eq(bundleProven.bundleId)
      expect(bundleRoot).to.eq(bundleProven.bundleRoot)
      const bundleHash = keccak256(defaultAbiCoder.encode(
        ['uint256', 'uint256', 'bytes32', 'bytes32'],
        [fromChainId, toChainId, bundleId, bundleRoot]
      ))
      expect(bundleHash).to.eq(bundleProven.bundleHash)

      const unspentMessageIds = fixture.getUnspentMessageIds(
        bundleCommitted.bundleId
      )

      for (let i = 0; i < unspentMessageIds.length; i++) {
        const messageId = unspentMessageIds[i]
        const { messageExecuted, message } = await fixture.executeMessage(
          messageId
        )

        if (!messageExecuted) throw new Error('No MessageExecuted event found')
        expect(message.fromChainId).to.eq(messageExecuted.fromChainId)
        expect(messageId).to.eq(messageExecuted.messageId)

        if (!messageBundled) throw new Error('No MessageBundled event found')
        const executor = fixture.executors[toChainId.toString()]
        await executor.isMessageSpent(
          bundleId,
          messageBundled.treeIndex
        )

        await expectMessageReceiverState(
          messageReceiver,
          DEFAULT_RESULT,
          executor.address,
          sender.address,
          fromChainId
        )
      }
    })
  })
})

describe('Dispatcher', function () {
  describe('dispatchMessage', function () {
    describe('should revert if toChainId is not supported', async function () {
      let fromChainId: BigNumber
      it('from hub', async function () {
        fromChainId = SPOKE_CHAIN_ID_0
      })

      it('from spoke', async function () {
        fromChainId = HUB_CHAIN_ID
      })

      afterEach(async function () {
        const toChainId = 7653
        const [sender] = await ethers.getSigners()

        const { fixture } = await Fixture.deploy(HUB_CHAIN_ID, [
          SPOKE_CHAIN_ID_0,
          SPOKE_CHAIN_ID_1,
        ])

        expect(
          fixture.dispatchMessage(sender, {
            fromChainId,
            toChainId,
          })
        ).to.be.revertedWith(`InvalidRoute(${toChainId})`)
      })
    })
  })
})

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

      const { messageSent, messageBundled } = await fixture.dispatchMessage(
        sender,
        { data: '0xdeadbeef' }
      )

      const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
      await fixture.dispatchMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted } = await fixture.dispatchMessage(sender)
      if (!bundleCommitted || !bundleCommitted?.bundleId) {
        throw new Error('No bundleCommitted event')
      }

      const executor = fixture.executors[toChainId.toString()]
      if (!messageBundled) throw new Error('No messageBundled event')
      const isSpent = await executor.isMessageSpent(
        messageBundled.bundleId,
        messageBundled.treeIndex
      )
      expect(isSpent).to.be.false
    })

    describe('with standard setup', function () {
      let fixture: Fixture
      let bundleId: string
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
        if (!bundleCommitted || !bundleCommitted?.bundleId) {
          throw new Error('No bundleCommitted event')
        }
        bundleId = bundleCommitted.bundleId
      })

      it('should not allow invalid fromChainId', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            fromChainId: SPOKE_CHAIN_ID_1,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow invalid from', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            from: '0x0000000000000000000000000000000000000099',
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow invalid to', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            to: '0x0000000000000000000000000000000000000098',
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow invalid message data', async function () {
        const invalidData = await getSetResultCalldata(2831082398)
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            data: invalidData,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      // BundleProof
      it('should not allow invalid bundleId', async function () {
        const invalidBundleId =
          '0x0123456789012345678901234567890123456789012345678901234567891234'
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            bundleId: invalidBundleId,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow invalid treeIndex', async function () {
        await expect(
          fixture.executeMessage(messageSent.messageId, {
            treeIndex: 1,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow invalid proof', async function () {
        const messageId = messageSent.messageId
        const wrongMessageId = fixture.bundles[bundleId].messageIds[1]
        const wrongProof = fixture.getProof(bundleId, wrongMessageId)
        await expect(
          fixture.executeMessage(messageId, {
            siblings: wrongProof,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow extra siblings', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
        const proof = fixture.getProof(bundleId, messageId)
        proof.push(proof[proof.length - 1])
        await expect(
          fixture.executeMessage(messageId, {
            siblings: proof,
            totalLeaves,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow empty proof for non single element tree', async function () {
        const messageId = messageSent.messageId
        await expect(
          fixture.executeMessage(messageId, {
            siblings: [],
            totalLeaves: 1,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow totalLeaves + 1', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves,
          })
        ).to.be.revertedWith(
          'Lib_MerkleTree: Total siblings does not correctly correspond to total leaves.'
        )
      })

      it('should not allow totalLeaves / 2', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleId].messageIds.length / 2
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves,
          })
        ).to.be.revertedWith(
          'Lib_MerkleTree: Total siblings does not correctly correspond to total leaves.'
        )
      })

      it('should not allow 0 totalLeaves', async function () {
        const messageId = messageSent.messageId
        await expect(
          fixture.executeMessage(messageId, {
            totalLeaves: 0,
          })
        ).to.be.revertedWith('Lib_MerkleTree: Total leaves must be greater than zero.')
      })

      it('should not allow just root as sibling', async function () {
        const messageId = messageSent.messageId
        const root = fixture.getBundle(messageId).bundleRoot
        await expect(
          fixture.executeMessage(messageId, {
            siblings: [root],
            totalLeaves: 2,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
      })

      it('should not allow the same message to be relayed twice', async function () {
        const messageId = messageSent.messageId
        const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
        const proof = fixture.getProof(bundleId, messageId)
        proof.push(proof[proof.length - 1])
        await expect(
          fixture.executeMessage(messageId, {
            siblings: proof,
            totalLeaves,
          })
        ).to.be.revertedWith('MessageVerificationFailed')
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
