import {
  BigNumber,
  BigNumberish,
  Signer,
  BytesLike,
  ContractTransaction,
  utils
} from 'ethers'
import { ethers } from 'hardhat'
const { keccak256 } = ethers.utils
import { MerkleTree } from 'merkletreejs'

import TransporterFixture from '../Transporter'

import {
  Dispatcher as IDispatcher,
  ExecutorManager as IExecutorManager,
  MockMessageReceiver as IMessageReceiver
} from '../../../typechain'
type Interface = utils.Interface

import { MESSAGE_FEE } from '../../utils/constants'
import Message from './Message'
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
  chainIds: BigNumber[]
  dispatchers: { [key: string]: IDispatcher }
  executors: { [key: string]: IExecutorManager }
  messageReceivers: { [key: string]: IMessageReceiver }
  transporterFixture: TransporterFixture
  defaults: Defaults

  // dynamic state
  messageIds: string[]
  messages: { [key: string]: Message }
  messageIdsToBundleNonces: { [key: string]: string }
  bundleNonces: string[]
  bundles: {
    [key: string]: {
      bundleNonce: string
      messageIds: string[]
      bundleRoot: string
      fromChainId: BigNumber
      toChainId: BigNumber
      bundleFees: BigNumber
    }
  }
  spentMessageIds: { [key: string]: boolean }

  constructor(
    _chainIds: BigNumber[],
    _dispatchers: IDispatcher[],
    _executors: IExecutorManager[],
    _messageReceivers: IMessageReceiver[],
    _transporterFixture: TransporterFixture,
    _defaults: Defaults
  ) {
    if (
      _chainIds.length !== _dispatchers.length &&
      _chainIds.length !== _executors.length &&
      _chainIds.length !== _messageReceivers.length
    ) {
      throw new Error('chainIds and contract arrays must be same length')
    }

    this.chainIds = _chainIds
    this.transporterFixture = _transporterFixture
    this.defaults = _defaults
    this.dispatchers = {}
    this.executors = {}
    this.messageReceivers = {}

    for (let i = 0; i < _chainIds.length; i++) {
      const chainId = _chainIds[i].toString()
      this.dispatchers[chainId] = _dispatchers[i]
      this.executors[chainId] = _executors[i]
      this.messageReceivers[chainId] = _messageReceivers[i]
    }

    this.defaults = _defaults

    this.messageIds = []
    this.messages = {}
    this.messageIdsToBundleNonces = {}
    this.bundleNonces = []
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

  async dispatchMessageRepeat(
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
      await this.dispatchMessage(fromSigner, overrides)
    }
  }

  async dispatchMessage(
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

    const dispatcher = this.dispatchers[fromChainId.toString()]

    const tx = await dispatcher
      .connect(fromSigner)
      .dispatchMessage(toChainId, to, data, {
        value: MESSAGE_FEE,
      })
    const { messageSent, messageBundled, bundleCommitted } =
      await this.getSendMessageEvents(tx)

    let messageExecuted
    if (!messageBundled) throw new Error('MessageBundled event not found')
    const bundleNonce = messageBundled?.bundleNonce
    const treeIndex = messageBundled?.treeIndex
    if (!bundleNonce || !treeIndex) {
      throw new Error('Missing MessageBundled event data')
    }

    const message = new Message(
      bundleNonce,
      treeIndex,
      fromChainId,
      from,
      toChainId,
      to,
      data
    )

    this.messageIds.push(messageSent.messageId)
    this.messages[messageSent.messageId] = message

    let bundlePosted
    let bundleProven
    let bundlePostedTx
    if (bundleCommitted) {
      const bundleNonce = bundleCommitted.bundleNonce

      // save bundle
      this.bundleNonces.push(bundleNonce)
      const bundle = {
        fromChainId: BigNumber.from(fromChainId),
        messageIds: this.messageIds,
        ...bundleCommitted,
      }
      this.bundles[bundleNonce] = bundle

      this.messageIds.forEach(messageId => {
        this.messageIdsToBundleNonces[messageId] = bundleNonce
      })

      this.messageIds = []

      // transport the bundle to destination
      const { firstConnectionTx } = await this.transporterFixture.relayCommitment(
        fromChainId,
        toChainId
      )
      if (!firstConnectionTx) throw new Error('No commitment relayed')

      // prove the bundle at destination
      const executor = this.executors[toChainId.toString()]
      const transporter = this.transporterFixture.transporters[toChainId.toString()]
      const bundleProvenTx = await executor.proveBundle(
        transporter.address,
        fromChainId.toString(),
        bundle.bundleNonce,
        bundle.bundleRoot
      )
      bundleProven = await this.getBundleProvenEvent(bundleProvenTx)
    }

    return {
      tx,
      messageSent,
      messageBundled,
      bundleCommitted,
      bundlePosted,
      bundleProven,
      messageExecuted,
      bundlePostedTx
    }
  }

  async executeMessage(
    messageId: string,
    overrides?: Partial<{
      fromChainId: BigNumberish
      from: string
      toChainId: BigNumberish
      to: string
      data: string
      bundleNonce: string
      treeIndex: BigNumberish
      siblings: string[]
      totalLeaves: BigNumberish
    }>
  ) {
    const message = this.messages[messageId]
    if (!message) throw new Error('Message for messageId not found')
    const storedBundleNonce = this.messageIdsToBundleNonces[messageId]
    if (!storedBundleNonce) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleNonce]
    if (!storedBundle) throw new Error('Bundle for messageId not found')

    const fromChainId = overrides?.fromChainId ?? message.fromChainId
    const from = overrides?.from ?? message.from
    const toChainId = overrides?.toChainId ?? message.toChainId
    const to = overrides?.to ?? message.to
    const data = overrides?.data ?? message.data
    const bundleNonce = overrides?.bundleNonce ?? storedBundle.bundleNonce

    const treeIndex =
      overrides?.treeIndex ?? storedBundle.messageIds.indexOf(messageId)
    const siblings = overrides?.siblings ?? this.getProof(messageId)
    const totalLeaves = overrides?.totalLeaves ?? storedBundle.messageIds.length

    const executor = this.executors[toChainId.toString()]
    const tx = await executor.executeMessage(
      fromChainId,
      from,
      to,
      data,
      {
        bundleNonce,
        treeIndex,
        siblings,
        totalLeaves
      }
    )

    const messageExecuted = await this.getExecuteMessageEvent(tx)

    this.spentMessageIds[messageId] = true

    return { tx, messageExecuted, message }
  }

  getProof(messageId: string) {
    const storedBundleNonce = this.messageIdsToBundleNonces[messageId]
    if (!storedBundleNonce) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleNonce]
    if (!storedBundle) throw new Error('Bundle for messageId not found')

    const tree = new MerkleTree(storedBundle.messageIds, keccak256)
    const proof = tree
      .getProof(messageId)
      .map(node => '0x' + node.data.toString('hex'))

    return proof
  }

  getUnspentMessageIds(bundleNonce: string) {
    const bundle = this.bundles[bundleNonce]
    return bundle.messageIds.filter((messageId: string) => {
      return !this.spentMessageIds[messageId]
    })
  }

  getMessageReceiver(chainId?: BigNumberish) {
    chainId = chainId ? BigNumber.from(chainId) : this.defaults.toChainId
    return this.messageReceivers[chainId.toString()]
  }

  getBundle(messageId: string) {
    const message = this.messages[messageId]
    if (!message) throw new Error('Message for messageId not found')
    const storedBundleNonce = this.messageIdsToBundleNonces[messageId]
    if (!storedBundleNonce) throw new Error('Bundle for messageId not found')
    const storedBundle = this.bundles[storedBundleNonce]
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
        bundleNonce: messageBundledEvent.args.bundleNonce as string,
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
        bundleNonce: bundleCommittedEvent.args.bundleNonce as string,
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

  async getExecuteMessageEvent(tx: ContractTransaction) {
    const receipt = await tx.wait()

    const executorHead = await ethers.getContractFactory('ExecutorHead')
    const messageExecutedEvent = await this._getRawEvent(
      tx,
      executorHead.interface,
      'MessageIdExecuted(uint256,bytes32)'
    )
    const messageExecuted = messageExecutedEvent
      ? {
          fromChainId: messageExecutedEvent.args.fromChainId as BigNumber,
          messageId: messageExecutedEvent.args.messageId as string,
        }
      : undefined

    return messageExecuted
  }

  async getBundleProvenEvent(tx: ContractTransaction) {
    const receipt = await tx.wait()

    const bundleProvenEvent = receipt.events?.find(
      e => e.event === 'BundleProven'
    )
    if (!bundleProvenEvent?.args) throw new Error('No BundleProven event found')
    const bundleProven = {
      fromChainId: bundleProvenEvent.args.fromChainId as BigNumber,
      bundleNonce: bundleProvenEvent.args.bundleNonce as string,
      bundleRoot: bundleProvenEvent.args.bundleRoot as string,
      bundleId: bundleProvenEvent.args.bundleId as string
    }

    return bundleProven
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
