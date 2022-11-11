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
import Fixture, { MessageSentEvent } from './Fixture'
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

    // Clean run

    it('Should complete a clean run', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID
      const [deployer, sender, relayer] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture, hubBridge } = await Fixture.deploy(HUB_CHAIN_ID, [
        SPOKE_CHAIN_ID_0,
        SPOKE_CHAIN_ID_1,
      ])

      const { messageSent } = await fixture.sendMessage(sender)

      const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
      await fixture.sendMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted, bundleReceived, bundleSet } =
        await fixture.sendMessage(sender)
      if (!bundleCommitted) throw new Error('Bundle not committed')
      if (!bundleReceived) throw new Error('Bundle not received at Hub')
      if (!bundleSet) throw new Error('Bundle not set on Hub')

      const unspentMessageIds = fixture.getUnspentMessageIds(
        bundleCommitted.bundleId
      )

      const { messageRelayed, message } = await fixture.relayMessage(
        messageSent.messageId
      )

      for (let i = 1; i < unspentMessageIds.length; i++) {
        const messageId = unspentMessageIds[i]
        const { messageRelayed, message } = await fixture.relayMessage(
          messageId
        )
      }
    })

    // with large data
    // with empty data

    // non-happy path
    // with hub
    // with spoke
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
          fixture.sendMessage(sender, {
            fromChainId,
            toChainId,
          })
        ).to.be.revertedWith(`InvalidRoute(${toChainId})`)
      })
    })

    describe('should revert if relaying message to connector address', async function () {
      it('from spoke to hub', async function () {
        const fromChainId = SPOKE_CHAIN_ID_0
        const toChainId = HUB_CHAIN_ID
        const [sender] = await ethers.getSigners()

        const { fixture } = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
          { fromChainId, toChainId }
        )

        const connector = fixture.hubConnectors[fromChainId.toString()]

        const { messageSent } = await fixture.sendMessage(sender, {
          to: connector.address,
        })

        const numFillerMessages = MAX_BUNDLE_MESSAGES - 1
        await fixture.sendMessageRepeat(numFillerMessages, sender)

        await expect(
          fixture.relayMessage(messageSent.messageId)
        ).to.be.revertedWith(`CannotMessageAddress("${connector.address}")`)
      })

      it('from spoke to spoke', async function () {
        const fromChainId = SPOKE_CHAIN_ID_0
        const toChainId = SPOKE_CHAIN_ID_0
        const [sender] = await ethers.getSigners()

        const { fixture } = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
          { fromChainId, toChainId }
        )

        const connector = fixture.spokeConnectors[toChainId.toString()]

        const { messageSent } = await fixture.sendMessage(sender, {
          to: connector.address,
        })

        const numFillerMessages = MAX_BUNDLE_MESSAGES - 1
        await fixture.sendMessageRepeat(numFillerMessages, sender)

        await expect(
          fixture.relayMessage(messageSent.messageId)
        ).to.be.revertedWith(`CannotMessageAddress("${connector.address}")`)
      })

      it('from hub to spoke', async function () {
        const fromChainId = HUB_CHAIN_ID
        const toChainId = SPOKE_CHAIN_ID_0
        const [sender] = await ethers.getSigners()

        const { fixture } = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
          { fromChainId, toChainId }
        )

        const connector = fixture.spokeConnectors[toChainId.toString()]

        await expect(
          fixture.sendMessage(sender, { to: connector.address })
        ).to.be.revertedWith(`CannotMessageAddress("${connector.address}")`)
      })
    })
  })

  describe('relayMessage', function () {
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

      const sendMessageEvents = await fixture.sendMessage(sender)
      messageSent = sendMessageEvents?.messageSent

      const numFillerMessages = MAX_BUNDLE_MESSAGES - 2
      await fixture.sendMessageRepeat(numFillerMessages, sender)

      const { bundleCommitted } = await fixture.sendMessage(sender)
      if (!bundleCommitted || !bundleCommitted?.bundleId) {
        throw new Error('No bundleCommitted event')
      }
      bundleId = bundleCommitted.bundleId
    })

    it('should not allow invalid fromChainId', async function () {
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          fromChainId: SPOKE_CHAIN_ID_1,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow invalid from', async function () {
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          from: '0x0000000000000000000000000000000000000099',
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow invalid to', async function () {
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          to: '0x0000000000000000000000000000000000000098',
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow invalid message data', async function () {
      const invalidData = await getSetResultCalldata(2831082398)
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          data: invalidData,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    // BundleProof
    it('should not allow invalid bundleId', async function () {
      const invalidBundleId =
        '0x0123456789012345678901234567890123456789012345678901234567891234'
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          bundleId: invalidBundleId,
        })
      ).to.be.revertedWith(`BundleNotFound("${invalidBundleId}")`)
    })

    it('should not allow invalid treeIndex', async function () {
      await expect(
        fixture.relayMessage(messageSent.messageId, {
          treeIndex: 1,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow invalid proof', async function () {
      const messageId = messageSent.messageId
      const wrongMessageId = fixture.bundles[bundleId].messageIds[1]
      const wrongProof = fixture.getProof(bundleId, wrongMessageId)
      await expect(
        fixture.relayMessage(messageId, {
          siblings: wrongProof,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow extra siblings', async function () {
      const messageId = messageSent.messageId
      const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
      const proof = fixture.getProof(bundleId, messageId)
      proof.push(proof[proof.length - 1])
      await expect(
        fixture.relayMessage(messageId, {
          siblings: proof,
          totalLeaves,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow empty proof for non single element tree', async function () {
      const messageId = messageSent.messageId
      await expect(
        fixture.relayMessage(messageId, {
          siblings: [],
          totalLeaves: 1,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow totalLeaves + 1', async function () {
      const messageId = messageSent.messageId
      const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
      await expect(
        fixture.relayMessage(messageId, {
          totalLeaves,
        })
      ).to.be.revertedWith('Lib_MerkleTree: Total siblings does not correctly correspond to total leaves.')
    })

    it('should not allow totalLeaves / 2', async function () {
      const messageId = messageSent.messageId
      const totalLeaves = fixture.bundles[bundleId].messageIds.length / 2
      await expect(
        fixture.relayMessage(messageId, {
          totalLeaves,
        })
      ).to.be.revertedWith('Lib_MerkleTree: Total siblings does not correctly correspond to total leaves.')
    })

    it('should not allow 0 totalLeaves', async function () {
      const messageId = messageSent.messageId
      await expect(
        fixture.relayMessage(messageId, {
          totalLeaves: 0,
        })
      ).to.be.revertedWith('Lib_MerkleTree: Total leaves must be greater than zero.')
    })

    it('should not allow just root as sibling', async function () {
      const messageId = messageSent.messageId
      const root = fixture.getBundle(messageId).bundleRoot
      await expect(
        fixture.relayMessage(messageId, {
          siblings: [root],
          totalLeaves: 2,
        })
      ).to.be.revertedWith('InvalidProof')
    })

    it('should not allow the same message to be relayed twice', async function () {
      const messageId = messageSent.messageId
      const totalLeaves = fixture.bundles[bundleId].messageIds.length + 1
      const proof = fixture.getProof(bundleId, messageId)
      proof.push(proof[proof.length - 1])
      await expect(
        fixture.relayMessage(messageId, {
          siblings: proof,
          totalLeaves,
        })
      ).to.be.revertedWith('InvalidProof')
    })
  })

  describe('getXDomainChainId', function () {
    it('should revert when called directly', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID

      const { fixture } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      await expect(fixture.hubBridge.getXDomainChainId()).to.be.revertedWith(
        'NotCrossDomainMessage'
      )
    })
  })

  describe('getXDomainSender', function () {
    it('should revert when called directly', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID

      const { fixture } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      await expect(fixture.hubBridge.getXDomainChainId()).to.be.revertedWith(
        'NotCrossDomainMessage'
      )
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

      const chainId = await fixture.hubBridge.getChainId()
      expect(chainId).to.eq(HUB_CHAIN_ID)
    })
  })
})

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
