import { expect } from 'chai'
import { ContractTransaction, BigNumber, BigNumberish, Signer, providers } from 'ethers'
import { ethers } from 'hardhat'
import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_RESULT,
  DEFAULT_FROM_CHAIN_ID,
  DEFAULT_TO_CHAIN_ID,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
} from './constants'
import Bridge, { SpokeBridge, HubBridge } from './Bridge'
type Provider = providers.Provider
const { provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils
import Fixture from './Fixture'
import { getSetResultCalldata } from './utils'
import type { MockMessageReceiver as IMessageReceiver } from '../typechain'

describe('MessageBridge', function () {
  describe('sendMessage', function () {
    it('Should complete a full Spoke to Hub bundle', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID
      const [deployer, sender, relayer] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture, hubBridge } = await Fixture.deploy(HUB_CHAIN_ID, [
        SPOKE_CHAIN_ID_0,
        SPOKE_CHAIN_ID_1,
      ])

      const { messageSent } = await fixture.sendMessage(sender)

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
      await fixture.sendMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted, bundleReceived, bundleSet } =
        await fixture.sendMessage(sender)
      if (!bundleCommitted) throw new Error('Bundle not committed')
      if (!bundleReceived) throw new Error('Bundle not received at Hub')
      if (!bundleSet) throw new Error('Bundle not set on Hub')

      // BundleCommitted event
      const bundleId = bundleCommitted.bundleId
      const bundleRoot = bundleCommitted.bundleRoot
      const commitTime = bundleCommitted.commitTime
      const expectedFullBundleFee =
        BigNumber.from(MESSAGE_FEE).mul(MAX_BUNDLE_MESSAGES)
      expect(expectedFullBundleFee).to.eq(bundleCommitted.bundleFees)
      expect(toChainId).to.eq(bundleCommitted.toChainId)

      // BundleReceived event
      expect(bundleId).to.eq(bundleReceived.bundleId)
      expect(bundleRoot).to.eq(bundleReceived.bundleRoot)
      expect(expectedFullBundleFee).to.eq(bundleReceived.bundleFees)
      expect(fromChainId).to.eq(bundleReceived.fromChainId)
      expect(toChainId).to.eq(bundleReceived.toChainId)
      const exitTime = await fixture.hubBridge.getSpokeExitTime(fromChainId)
      expect(commitTime.add(exitTime)).to.eq(bundleReceived.relayWindowStart)
      expect(deployer.address).to.eq(bundleReceived.relayer)

      // BundleSet event
      expect(bundleId).to.eq(bundleSet.bundleId)
      expect(bundleRoot).to.eq(bundleSet.bundleRoot)
      expect(fromChainId).to.eq(bundleSet.fromChainId)

      const unspentMessageIds = fixture.getUnspentMessageIds(
        bundleCommitted.bundleId
      )

      for (let i = 0; i < unspentMessageIds.length; i++) {
        const messageId = unspentMessageIds[i]
        const { messageRelayed, message } = await fixture.relayMessage(
          messageId
        )

        if (!messageRelayed) throw new Error('No MessageRelayed event found')
        expect(messageId).to.eq(messageRelayed.messageId)
        expect(message.fromChainId).to.eq(messageRelayed.fromChainId)
        expect(message.from).to.eq(messageRelayed.from)
        expect(message.to).to.eq(messageRelayed.to)

        const destinationBridge = fixture.bridges[toChainId.toString()].address
        await expectMessageReceiverState(
          messageReceiver,
          DEFAULT_RESULT,
          destinationBridge,
          sender.address,
          fromChainId
        )
      }

      const feeDistributor = fixture.getFeeDistributor()
      const feeDistributorBalance = await provider.getBalance(
        feeDistributor.address
      )
      expect(expectedFullBundleFee).to.eq(feeDistributorBalance)
    })

    it('Should complete a full Spoke to Spoke bundle', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = SPOKE_CHAIN_ID_1
      const [deployer, sender, relayer] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture, hubBridge } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { toChainId }
      )
      const messageReceiver = fixture.getMessageReceiver(toChainId)

      const { messageSent } = await fixture.sendMessage(sender)

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
      await fixture.sendMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted, bundleReceived, bundleSet } =
        await fixture.sendMessage(sender)
      if (!bundleCommitted) throw new Error('Bundle not committed')
      if (!bundleReceived) throw new Error('Bundle not received at Hub')
      if (!bundleSet) throw new Error('Bundle not set on Hub')

      // BundleCommitted event
      const bundleId = bundleCommitted.bundleId
      const bundleRoot = bundleCommitted.bundleRoot
      const commitTime = bundleCommitted.commitTime
      const expectedFullBundleFee =
        BigNumber.from(MESSAGE_FEE).mul(MAX_BUNDLE_MESSAGES)
      expect(expectedFullBundleFee).to.eq(bundleCommitted.bundleFees)
      expect(toChainId).to.eq(bundleCommitted.toChainId)

      // BundleReceived event
      expect(bundleId).to.eq(bundleReceived.bundleId)
      expect(bundleRoot).to.eq(bundleReceived.bundleRoot)
      expect(expectedFullBundleFee).to.eq(bundleReceived.bundleFees)
      expect(fromChainId).to.eq(bundleReceived.fromChainId)
      expect(toChainId).to.eq(bundleReceived.toChainId)
      const exitTime = await fixture.hubBridge.getSpokeExitTime(fromChainId)
      expect(commitTime.add(exitTime)).to.eq(bundleReceived.relayWindowStart)
      expect(deployer.address).to.eq(bundleReceived.relayer)

      // MessageSent event
      expect(bundleId).to.eq(bundleSet.bundleId)
      expect(bundleRoot).to.eq(bundleSet.bundleRoot)
      expect(fromChainId).to.eq(bundleSet.fromChainId)

      const unspentMessageIds = fixture.getUnspentMessageIds(
        bundleCommitted.bundleId
      )

      for (let i = 0; i < unspentMessageIds.length; i++) {
        const messageId = unspentMessageIds[i]
        const { messageRelayed, message } = await fixture.relayMessage(
          messageId
        )

        if (!messageRelayed) throw new Error('No MessageRelayed event found')
        expect(messageId).to.eq(messageRelayed.messageId)
        expect(message.fromChainId).to.eq(messageRelayed.fromChainId)
        expect(message.from).to.eq(messageRelayed.from)
        expect(message.to).to.eq(messageRelayed.to)

        const destinationBridge = fixture.bridges[toChainId.toString()].address
        await expectMessageReceiverState(
          messageReceiver,
          DEFAULT_RESULT,
          destinationBridge,
          sender.address,
          fromChainId
        )
      }

      const feeDistributor = fixture.getFeeDistributor()
      const feeDistributorBalance = await provider.getBalance(
        feeDistributor.address
      )
      expect(expectedFullBundleFee).to.eq(feeDistributorBalance)
    })

    it('Should call contract Hub to Spoke', async function () {
      const fromChainId = HUB_CHAIN_ID
      const toChainId = SPOKE_CHAIN_ID_0
      const [deployer, sender, relayer] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture, hubBridge } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )
      const messageReceiver = fixture.getMessageReceiver(toChainId)

      const { messageSent, messageRelayed } = await fixture.sendMessage(sender)
      if (!messageRelayed) throw new Error('No message relayed')

      // MessageSent event
      expect(sender.address.toLowerCase()).to.eq(messageSent.from.toLowerCase())
      expect(toChainId).to.eq(messageSent.toChainId)
      expect(messageReceiver.address.toLowerCase()).to.eq(
        messageSent.to.toLowerCase()
      )
      expect(data.toString().toLowerCase()).to.eq(
        messageSent.data.toLowerCase()
      )

      // MessageRelayed event
      const messageId = messageSent.messageId
      expect(messageId).to.eq(messageRelayed.messageId)
      expect(fromChainId).to.eq(messageRelayed.fromChainId)
      expect(sender.address).to.eq(messageRelayed.from)
      expect(messageReceiver.address).to.eq(messageRelayed.to)

      const destinationBridge = fixture.bridges[toChainId.toString()].address
      await expectMessageReceiverState(
        messageReceiver,
        DEFAULT_RESULT,
        destinationBridge,
        sender.address,
        fromChainId
      )
    })

    // with large data
    // with empty data

    // non-happy path
    // with hub
    // with spoke
    it('It should revert if toChainId is not supported', async function () {
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
          fixture.sendMessage(sender, {
            fromChainId,
            toChainId,
          })
        ).to.be.revertedWith(`InvalidRoute(${toChainId})`)
      })
    })

    // just hub
    it('It should revert if to is a spoke bridge', async function () {})
    // just spoke
    it('It should revert if to is a hub bridge', async function () {})
  })

  describe('relayMessage', function () {
    it('Should not allow invalid nonce', async function () {})
    it('Should not allow invalid fromChainId', async function () {})
    it('Should not allow invalid from', async function () {})
    it('Should not allow invalid to', async function () {})
    it('Should not allow invalid data', async function () {})
    // BundleProof
    it('Should not allow invalid bundleId', async function () {})
    it('Should not allow invalid treeIndex', async function () {})
    it('Should not allow invalid siblings', async function () {})
    it('Should not allow extra siblings', async function () {})
    it('Should not allow empty siblings for non single element tree', async function () {})
    it('Should not allow totalLeaves + 1', async function () {})
    it('Should not allow totalLeaves - 1', async function () {})
    it('Should not allow 0', async function () {})

    it('Should not allow the same message to be relayed twice', async function () {})
  })

  describe('getXDomainChainId', function () {
    it('Should revert when called directly', async function () {})
  })

  describe('getXDomainSender', function () {
    it('Should revert when called directly', async function () {})
  })

  describe('getChainId', function () {
    it('Should return the chainId', async function () {})
  })
})

function getCalldataStats(calldata: string) {
  let data = calldata
  if (calldata.slice(0, 2) === '0x') {
    data = calldata.slice(2)
  }
  const calldataBytes = data.length / 2

  let zeroBytes = 0
  for (let i = 0; i < calldataBytes; i = i + 2) {
    const byte = data.slice(i, i + 2)
    if (byte === '00') {
      zeroBytes++
    }
  }
  const nonZeroBytes = calldataBytes - zeroBytes

  const calldataCost = zeroBytes * 4 + nonZeroBytes * 16
  return { calldataBytes, calldataCost }
}

async function expectMessageReceiverState(
  messageReceiver: IMessageReceiver,
  result: BigNumberish,
  msgSender: string,
  xDomainSender: string,
  xDomainChainId: BigNumberish,
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
