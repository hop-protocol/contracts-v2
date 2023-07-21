import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import getSetResultCalldata from '../../shared/utils/getSetResultCalldata'
import {
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_RESULT,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
} from '@hop-protocol/shared-utils/constants'
import Fixture from './fixture'
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
      const bundleNonce = bundleCommitted.bundleNonce
      const bundleRoot = bundleCommitted.bundleRoot
      const commitTime = bundleCommitted.commitTime
      const expectedFullBundleFee =
        BigNumber.from(MESSAGE_FEE).mul(MAX_BUNDLE_MESSAGES)
      expect(expectedFullBundleFee).to.eq(bundleCommitted.bundleFees)
      expect(toChainId).to.eq(bundleCommitted.toChainId)

      // BundleProven event
      expect(fromChainId).to.eq(bundleProven.fromChainId)
      expect(bundleNonce).to.eq(bundleProven.bundleNonce)
      expect(bundleRoot).to.eq(bundleProven.bundleRoot)
      const bundleId = keccak256(defaultAbiCoder.encode(
        ['uint256', 'uint256', 'bytes32', 'bytes32'],
        [fromChainId, toChainId, bundleNonce, bundleRoot]
      ))
      expect(bundleId).to.eq(bundleProven.bundleId)

      const unspentMessageIds = fixture.getUnspentMessageIds(
        bundleCommitted.bundleNonce
      )

      for (let i = 0; i < unspentMessageIds.length; i++) {
        const messageId = unspentMessageIds[i]
        const { messageExecuted, message } = await fixture.executeMessage(
          messageId
        )

        if (!messageExecuted) throw new Error('No MessageIdExecuted event found')
        expect(message.fromChainId).to.eq(messageExecuted.fromChainId)
        expect(messageId).to.eq(messageExecuted.messageId)

        if (!messageBundled) throw new Error('No MessageBundled event found')
        const executor = fixture.executors[toChainId.toString()]
        await executor.isMessageSpent(
          bundleNonce,
          messageBundled.treeIndex
        )

        const executorHead = await executor.head()
        await expectMessageReceiverState(
          messageReceiver,
          DEFAULT_RESULT,
          executorHead,
          sender.address,
          fromChainId
        )
      }
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
