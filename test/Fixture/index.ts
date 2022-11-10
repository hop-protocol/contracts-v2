import { expect } from 'chai'
import {
  BigNumber,
  BigNumberish,
  Signer,
  BytesLike,
  ContractTransaction,
  utils
} from 'ethers'
import { ethers } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils
import type {
  SpokeMessageBridge as ISpokeMessageBridge,
  HubMessageBridge as IHubMessageBridge,
  MessageBridge as IMessageBridge,
  MockMessageReceiver as IMessageReceiver,
  FeeDistributor as IFeeDistributor,
  MockConnector as IMockConnector,
} from '../../typechain'
type Interface = utils.Interface

import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
  DEFAULT_FROM_CHAIN_ID,
  DEFAULT_TO_CHAIN_ID,
  DEFAULT_RESULT,
} from '../constants'
import SpokeMessage from './SpokeMessage'
import deployFixture from './deployFixture'

export type Defaults = {
  fromChainId: BigNumber
  toChainId: BigNumber
  data: string
}

export type MessageSentEvent = {
  messageId: string
  from: string
  toChainId: BigNumber
  to: string
  data: string
}

class Fixture {
  // static state
  hubChainId: BigNumber
  hubBridge: IHubMessageBridge
  spokeChainIds: BigNumber[]
  spokeBridges: ISpokeMessageBridge[]
  bridges: { [key: string]: IMessageBridge }
  feeDistributors: { [key: string]: IFeeDistributor }
  hubConnectors: { [key: string]: IMockConnector }
  spokeConnectors: { [key: string]: IMockConnector }
  messageReceivers: { [key: string]: IMessageReceiver }
  defaults: Defaults

  // dynamic state
  messageIds: string[]
  messages: { [key: string]: SpokeMessage }
  messageIdsToBundleIds: { [key: string]: string }
  bundleIds: string[]
  bundles: {
    [key: string]: {
      bundleId: string
      messageIds: string[]
      bundleRoot: string
      fromChainId: BigNumber
      toChainId: BigNumber
      bundleFees: BigNumber
    }
  }
  spentMessageIds: { [key: string]: boolean }

  constructor(
    _hubChainId: BigNumber,
    _hubBridge: IHubMessageBridge,
    _hubMessageReceiver: IMessageReceiver,
    _spokeChainIds: BigNumber[],
    _spokeBridges: ISpokeMessageBridge[],
    _feeDistributors: IFeeDistributor[],
    _hubConnectors: IMockConnector[],
    _spokeConnectors: IMockConnector[],
    _spokeMessageReceivers: IMessageReceiver[],
    _defaults: Defaults
  ) {
    if (_spokeChainIds.length !== _spokeBridges.length) {
      throw new Error('spokeChainIds and spokeBridges must be same length')
    }

    this.hubChainId = _hubChainId
    this.hubBridge = _hubBridge
    this.spokeChainIds = _spokeChainIds
    this.spokeBridges = _spokeBridges

    const bridges: { [key: string]: IMessageBridge } = {
      [_hubChainId.toString()]: _hubBridge,
    }
    const feeDistributors: { [key: string]: IFeeDistributor } = {}
    const hubConnectors: { [key: string]: IMockConnector } = {}
    const spokeConnectors: { [key: string]: IMockConnector } = {}
    const messageReceivers = {
      [_hubChainId.toString()]: _hubMessageReceiver,
    }

    for (let i = 0; i < _spokeChainIds.length; i++) {
      const spokeChainId = _spokeChainIds[i].toString()
      bridges[spokeChainId] = _spokeBridges[i]
      feeDistributors[spokeChainId] = _feeDistributors[i]
      hubConnectors[spokeChainId] = _hubConnectors[i]
      spokeConnectors[spokeChainId] = _spokeConnectors[i]
      messageReceivers[spokeChainId] = _spokeMessageReceivers[i]
    }
    this.bridges = bridges
    this.feeDistributors = feeDistributors
    this.hubConnectors = hubConnectors
    this.spokeConnectors = spokeConnectors
    this.messageReceivers = messageReceivers

    this.defaults = _defaults

    this.messageIds = []
    this.messages = {}
    this.messageIdsToBundleIds = {}
    this.bundleIds = []
    this.bundles = {}
    this.spentMessageIds = {}
  }

  static async deploy(
    _hubChainId: BigNumberish,
    _spokeChainIds: BigNumberish[],
    _defaults: Partial<Defaults> = {}
  ) {
    return deployFixture(_hubChainId, _spokeChainIds, _defaults)
  }

  async sendMessageRepeat(
    count: BigNumberish,
    fromSigner: Signer,
    overrides?: Partial<{
      fromChainId: BigNumberish
      toChainId: BigNumberish
      to: string
      data: BytesLike
    }>
  ) {
    count = BigNumber.from(count)
    for (let i = 0; count.gt(i); i++) {
      await this.sendMessage(fromSigner, overrides)
    }
  }

  async sendMessage(
    fromSigner: Signer,
    overrides?: Partial<{
      fromChainId: BigNumberish
      toChainId: BigNumberish
      to: string
      data: BytesLike
    }>
  ) {
    const fromChainId = overrides?.fromChainId ?? this.defaults.fromChainId
    const from = await fromSigner.getAddress()
    const toChainId = overrides?.toChainId ?? this.defaults.toChainId
    const messageReceiver = this.getMessageReceiver(toChainId)
    const to =
      overrides?.to ??
      messageReceiver?.address ??
      '0x0000000000000000000000000000000000000001'
    const data = overrides?.data ?? this.defaults.data

    const bridge = this.bridges[fromChainId.toString()]

    const tx = await bridge
      .connect(fromSigner)
      .sendMessage(toChainId, to, data, {
        value: MESSAGE_FEE,
      })
    const { messageSent, messageBundled, bundleCommitted } =
      await this.getSendMessageEvents(tx)

    let messageRelayed
    let messageReverted
    if (messageBundled) {
      const bundleId = messageBundled?.bundleId
      const treeIndex = messageBundled?.treeIndex
      if (!bundleId || !treeIndex) {
        throw new Error('Missing MessageBundled event data')
      }

      const message = new SpokeMessage(
        bundleId,
        treeIndex,
        fromChainId,
        from,
        toChainId,
        to,
        data
      )

      this.messageIds.push(messageSent.messageId)
      this.messages[messageSent.messageId] = message
    } else {
      // exit the message here
      const { firstConnectionTx } = await this.relayConnectorMessage(
        fromChainId,
        toChainId
      )

      const relayMessageEvents = await this.getRelayMessageEvents(
        firstConnectionTx
      )
      messageRelayed = relayMessageEvents.messageRelayed
      messageReverted = relayMessageEvents.messageReverted
    }

    let firstConnectionTx
    let secondConnectionTx
    let bundleSet
    let bundleReceived
    let bundleForwarded
    if (bundleCommitted) {
      const bundleId = bundleCommitted.bundleId
      this.bundleIds.push(bundleId)
      this.bundles[bundleId] = {
        fromChainId: BigNumber.from(fromChainId),
        messageIds: this.messageIds,
        ...bundleCommitted,
      }

      this.messageIds.forEach(messageId => {
        this.messageIdsToBundleIds[messageId] = bundleId
      })

      this.messageIds = []

      // exit the bundle here
      const connectionTxs = await this.relayConnectorMessage(
        fromChainId,
        toChainId
      )
      firstConnectionTx = connectionTxs.firstConnectionTx
      secondConnectionTx = connectionTxs.secondConnectionTx
      if (!firstConnectionTx) throw new Error('No messages relayed')
      // ToDo: Check event data from relayReceipt
      const bundleExitEventsHub = await this.getBundleExitEvents(
        firstConnectionTx
      )
      let bundleExitEventsSpoke
      if (secondConnectionTx) {
        bundleExitEventsSpoke = await this.getBundleExitEvents(
          secondConnectionTx
        )
      }
      bundleSet =
        bundleExitEventsHub.bundleSet ?? bundleExitEventsSpoke?.bundleSet
      bundleReceived = bundleExitEventsHub.bundleReceived
      bundleForwarded = bundleExitEventsHub.bundleForwarded
    }

    return {
      tx,
      firstConnectionTx,
      secondConnectionTx,
      messageSent,
      messageBundled,
      bundleCommitted,
      bundleSet,
      bundleReceived,
      bundleForwarded,
      messageRelayed,
      messageReverted,
    }
  }

  async relayConnectorMessage(
    fromChainId: BigNumberish,
    toChainId: BigNumberish
  ) {
    // ToDO: Relay all messages
    fromChainId = fromChainId.toString()
    toChainId = toChainId.toString()
    let firstConnector: IMockConnector | undefined
    let secondConnector: IMockConnector | undefined
    if (this.hubChainId.eq(fromChainId)) {
      firstConnector = this.hubConnectors[toChainId]
    } else {
      firstConnector = this.spokeConnectors[fromChainId]
      if (!this.hubChainId.eq(toChainId)) {
        secondConnector = this.hubConnectors[toChainId]
      }
    }

    const firstConnectionTx = await this._relayBundleMessage(firstConnector)
    let secondConnectionTx
    if (secondConnector) {
      secondConnectionTx = await this._relayBundleMessage(secondConnector)
    }
    return { firstConnectionTx, secondConnectionTx }
  }

  async _relayBundleMessage(connector: IMockConnector) {
    if (!connector) throw new Error('No connector found')
    const tx = await connector.relay()
    return tx
  }

  async relayMessage(
    messageId: string,
    overrides?: Partial<{
      fromChainId: BigNumberish
      from: string
      toChainId: BigNumberish
      to: string
      data: string
      bundleId: string
      treeIndex: BigNumberish
      siblings: string[]
      totalLeaves: BigNumberish
    }>
  ) {
    const message = this.messages[messageId]
    if (!message) throw new Error('Message for messageId not found')
    const storedBundleId = this.messageIdsToBundleIds[messageId]
    if (!storedBundleId) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleId]
    if (!storedBundle) throw new Error('Bundle for messageId not found')

    const fromChainId = overrides?.fromChainId ?? message.fromChainId
    const from = overrides?.from ?? message.from
    const toChainId = overrides?.toChainId ?? message.toChainId
    const to = overrides?.to ?? message.to
    const data = overrides?.data ?? message.data
    const bundleId = overrides?.bundleId ?? storedBundle.bundleId

    const proof = this.getProof(bundleId, messageId)
    const siblings = overrides?.siblings ?? proof

    const treeIndex =
      overrides?.treeIndex ?? storedBundle.messageIds.indexOf(messageId)

    const totalLeaves = overrides?.totalLeaves ?? storedBundle.messageIds.length // ToDo: Is this needed? roundUpPowersOfTwo(storedBundle.messageIds.length)

    const bridge = this.bridges[toChainId.toString()]
    const tx = await bridge.relayMessage(fromChainId, from, to, data, {
      bundleId,
      treeIndex,
      siblings,
      totalLeaves,
    })

    const { messageRelayed } = await this.getRelayMessageEvents(tx)

    this.spentMessageIds[messageId] = true

    return { tx, messageRelayed, message }
  }

  getProof(bundleId: string, messageId: string) {
    const storedBundleId = this.messageIdsToBundleIds[messageId]
    if (!storedBundleId) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleId]
    if (!storedBundle) throw new Error('Bundle for messageId not found')

    const tree = new MerkleTree(storedBundle.messageIds, keccak256)
    const proof = tree
      .getProof(messageId)
      .map(node => '0x' + node.data.toString('hex'))

    return proof
  }

  getUnspentMessageIds(bundleId: string) {
    const bundle = this.bundles[bundleId]
    return bundle.messageIds.filter((messageId: string) => {
      return !this.spentMessageIds[messageId]
    })
  }

  getMessageReceiver(chainId?: BigNumberish) {
    chainId = chainId ? BigNumber.from(chainId) : this.defaults.toChainId
    return this.messageReceivers[chainId.toString()]
  }

  getFeeDistributor(chainId?: BigNumberish) {
    chainId = chainId ? BigNumber.from(chainId) : SPOKE_CHAIN_ID_0
    return this.feeDistributors[chainId.toString()]
  }

  getBundle(messageId: string) {
    const message = this.messages[messageId]
    if (!message) throw new Error('Message for messageId not found')
    const storedBundleId = this.messageIdsToBundleIds[messageId]
    if (!storedBundleId) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleId]
    if (!storedBundle) throw new Error('Bundle for messageId not found')

    return storedBundle
  }

  // Get events

  async getSendMessageEvents(tx: ContractTransaction) {
    const receipt = await tx.wait()

    const messageSentEvent = receipt.events?.find(
      e => e.event === 'MessageSent'
    )
    if (!messageSentEvent?.args) throw new Error('No MessageSent event found')
    const messageSent: MessageSentEvent = {
      messageId: messageSentEvent.args.messageId as string,
      from: messageSentEvent.args.from as string,
      toChainId: messageSentEvent.args.toChainId as BigNumber,
      to: messageSentEvent.args.to as string,
      data: messageSentEvent.args.data as string,
    }

    const messageBundledEvent = receipt.events?.find(
      e => e.event === 'MessageBundled'
    )
    let messageBundled
    if (messageBundledEvent?.args) {
      messageBundled = {
        bundleId: messageBundledEvent.args.bundleId as string,
        treeIndex: messageBundledEvent.args.treeIndex as BigNumber,
        messageId: messageBundledEvent.args.messageId as string,
      }
    }

    const bundleCommittedEvent = receipt.events?.find(
      e => e.event === 'BundleCommitted'
    )
    let bundleCommitted
    if (bundleCommittedEvent?.args) {
      bundleCommitted = {
        bundleId: bundleCommittedEvent.args.bundleId as string,
        bundleRoot: bundleCommittedEvent.args.bundleRoot as string,
        bundleFees: bundleCommittedEvent.args.bundleFees as BigNumber,
        toChainId: bundleCommittedEvent.args.toChainId as BigNumber,
        commitTime: bundleCommittedEvent.args.commitTime as BigNumber,
      }
    }

    return {
      messageSent,
      messageBundled,
      bundleCommitted,
    }
  }

  async getBundleExitEvents(tx: ContractTransaction) {
    const receipt = await tx.wait()

    // BundleSet
    const bundleSetEventRaw = receipt.events?.find(
      e =>
        e.topics[0] ===
        '0x9a17800d6f9f6089a26747bec54b04bf3b22ff2c893fe32ac63b3e397b5d9afc'
    )

    let bundleSet
    if (bundleSetEventRaw) {
      const bundleSetEvent =
        this.hubBridge.interface.parseLog(bundleSetEventRaw)
      bundleSet = {
        bundleId: bundleSetEvent.args.bundleId as string,
        bundleRoot: bundleSetEvent.args.bundleRoot as string,
        fromChainId: bundleSetEvent.args.fromChainId as BigNumber,
      }
    }

    // BundleReceived
    const bundleReceivedEventRaw = receipt.events?.find(
      e =>
        e.topics[0] ===
        '0xa9042860700683d69272195cc488bb6408e785469f38565cc38a1a779107319d'
    )
    let bundleReceived
    if (bundleReceivedEventRaw) {
      const bundleReceivedEvent = this.hubBridge.interface.parseLog(
        bundleReceivedEventRaw
      )
      bundleReceived = {
        bundleId: bundleReceivedEvent.args.bundleId as string,
        bundleRoot: bundleReceivedEvent.args.bundleRoot as string,
        bundleFees: bundleReceivedEvent.args.bundleFees as BigNumber,
        fromChainId: bundleReceivedEvent.args.fromChainId as BigNumber,
        toChainId: bundleReceivedEvent.args.toChainId as BigNumber,
        relayWindowStart: bundleReceivedEvent.args.relayWindowStart as BigNumber,
        relayer: bundleReceivedEvent.args.relayer as string,
      }
    }

    // BundleForwarded
    const bundleForwardedEventRaw = receipt.events?.find(
      e =>
        e.topics[0] ===
        '0x416f67b24b33d443009a07c9cc28fdc27b376e438f7d51b72207fc46d94862c9'
    )
    let bundleForwarded
    if (bundleForwardedEventRaw) {
      const bundleForwardedEvent = this.hubBridge.interface.parseLog(
        bundleForwardedEventRaw
      )
      bundleForwarded = {
        bundleId: bundleForwardedEvent.args.bundleId as string,
        bundleRoot: bundleForwardedEvent.args.bundleRoot as string,
        fromChainId: bundleForwardedEvent.args.fromChainId as BigNumber,
        toChainId: bundleForwardedEvent.args.toChainId as BigNumber,
      }
    }

    return { bundleSet, bundleReceived, bundleForwarded }
  }

  async getRelayMessageEvents(tx: ContractTransaction) {
    const messageRelayedEvent = await this._getRawEvent(
      tx,
      this.hubBridge.interface,
      'MessageRelayed(bytes32,uint256,address,address)'
    )
    const messageRelayed = messageRelayedEvent
      ? {
          messageId: messageRelayedEvent.args.messageId as string,
          fromChainId: messageRelayedEvent.args.fromChainId as BigNumber,
          from: messageRelayedEvent.args.from as string,
          to: messageRelayedEvent.args.to as string,
        }
      : undefined

    const messageRevertedEvent = await this._getRawEvent(
      tx,
      this.hubBridge.interface,
      'MessageReverted(bytes32,uint256,address,address)'
    )
    const messageReverted = messageRevertedEvent
      ? {
          messageId: messageRevertedEvent.args.messageId as string,
          fromChainId: messageRevertedEvent.args.fromChainId as BigNumber,
          from: messageRevertedEvent.args.from as string,
          to: messageRevertedEvent.args.to as string,
        }
      : undefined

    return { messageRelayed, messageReverted }
  }

  async _getRawEvent(
    tx: ContractTransaction,
    iface: Interface,
    eventSig: string
  ) {
    const receipt = await tx.wait()
    const topic = ethers.utils.id(eventSig)
    const rawEvent = receipt.events?.find(e => e.topics[0] === topic)
    if (!rawEvent) return
    return iface.parseLog(rawEvent)
  }
}

export default Fixture
