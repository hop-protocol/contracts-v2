import { expect } from 'chai'
import {
  BigNumber,
  BigNumberish,
  Signer,
  BytesLike,
  ContractTransaction,
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
} from '../typechain'

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
} from './constants'
import { getSetResultCalldata, getBundleRoot } from './utils'

export type Defaults =  {
  fromChainId: BigNumber
  toChainId: BigNumber
  data: string
}

export type Options = Partial<{ shouldLogGas: boolean }>

type Route = {
  chainId: BigNumberish
  messageFee: BigNumberish
  maxBundleMessages: BigNumberish
}

class Message {
  bundleId: string
  treeIndex: BigNumber
  fromChainId: BigNumber
  from: string
  toChainId: BigNumber
  to: string
  data: BytesLike

  constructor(
    _bundleId: string,
    _treeIndex: BigNumberish,
    _fromChainId: BigNumberish,
    _from: string,
    _toChainId: BigNumberish,
    _to: string,
    _data: BytesLike
  ) {
    this.bundleId = _bundleId
    this.treeIndex = BigNumber.from(_treeIndex)
    this.fromChainId = BigNumber.from(_fromChainId)
    this.from = _from
    this.toChainId = BigNumber.from(_toChainId)
    this.to = _to
    this.data = _data
  }

  getMessageId() {
    // ToDo: Handle hubMessageId or remove
    return keccak256(
      abi.encode(
        [
          'bytes32',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'address',
          'bytes',
        ],
        [
          this.bundleId,
          this.treeIndex,
          this.fromChainId,
          this.from,
          this.toChainId,
          this.to,
          this.data,
        ]
      )
    )
  }
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
  messages: { [key: string]: Message }
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
  }

  static async deploy(
    _hubChainId: BigNumberish,
    _spokeChainIds: BigNumberish[],
    _defaults: Partial<Defaults> = {}
  ) {
    const hubChainId = BigNumber.from(_hubChainId)
    const spokeChainIds = _spokeChainIds.map(n => BigNumber.from(n))

    // Factories
    const MessageReceiver = await ethers.getContractFactory(
      'MockMessageReceiver'
    )
    const FeeDistributor = await ethers.getContractFactory('ETHFeeDistributor')
    const Connector = await ethers.getContractFactory('MockConnector')

    const hubBridge = await this.deployHubBridge(hubChainId)
    const hubMessageReceiver = await MessageReceiver.deploy(hubBridge.address)

    const spokeBridges: ISpokeMessageBridge[] = []
    const feeDistributors: IFeeDistributor[] = []
    const hubConnectors: IMockConnector[] = []
    const spokeConnectors: IMockConnector[] = []
    const spokeMessageReceivers: IMessageReceiver[] = []
    for (let i = 0; i < spokeChainIds.length; i++) {
      const spokeChainId = spokeChainIds[i]
      const spokeBridge = await this.deploySpokeBridge(hubChainId, spokeChainId)
      spokeBridges.push(spokeBridge)

      const feeDistributor = await FeeDistributor.deploy(
        hubBridge.address,
        TREASURY,
        PUBLIC_GOODS,
        MIN_PUBLIC_GOODS_BPS,
        FULL_POOL_SIZE
      )
      feeDistributors.push(feeDistributor)

      // Deploy spoke and hub connectors here
      const hubConnector = await Connector.deploy(hubBridge.address)
      const spokeConnector = await Connector.deploy(spokeBridge.address)
      await hubConnector.setCounterpart(spokeConnector.address)
      await spokeConnector.setCounterpart(hubConnector.address)
      hubConnectors.push(hubConnector)
      spokeConnectors.push(spokeConnector)

      await hubBridge.setSpokeBridge(
        spokeChainId,
        hubConnector.address,
        ONE_WEEK,
        feeDistributor.address
      )
      spokeBridge.setHubBridge(spokeConnector.address, feeDistributor.address)

      const messageReceiver = await MessageReceiver.deploy(hubBridge.address)
      spokeMessageReceivers.push(messageReceiver)
    }

    const defaultDefaults: Defaults = {
      fromChainId: DEFAULT_FROM_CHAIN_ID,
      toChainId: DEFAULT_TO_CHAIN_ID,
      data: await getSetResultCalldata(DEFAULT_RESULT),
    }

    const defaults = Object.assign(defaultDefaults, _defaults)

    const fixture = new Fixture(
      hubChainId,
      hubBridge,
      hubMessageReceiver,
      spokeChainIds,
      spokeBridges,
      feeDistributors,
      hubConnectors,
      spokeConnectors,
      spokeMessageReceivers,
      defaults
    )

    return { fixture, hubBridge, spokeBridges, feeDistributors }
  }

  static async deployHubBridge(chainId: BigNumberish) {
    const HubMessageBridge = await ethers.getContractFactory(
      'MockHubMessageBridge'
    )

    return HubMessageBridge.deploy(chainId)
  }

  static async deploySpokeBridge(
    hubChainId: BigNumberish,
    spokeChainId: BigNumberish
  ) {
    const SpokeMessageBridge = await ethers.getContractFactory(
      'MockSpokeMessageBridge'
    )

    const defaultRoutes = [
      {
        chainId: HUB_CHAIN_ID,
        messageFee: MESSAGE_FEE,
        maxBundleMessages: MAX_BUNDLE_MESSAGES,
      },
      {
        chainId: SPOKE_CHAIN_ID_0,
        messageFee: MESSAGE_FEE,
        maxBundleMessages: MAX_BUNDLE_MESSAGES,
      },
      {
        chainId: SPOKE_CHAIN_ID_1,
        messageFee: MESSAGE_FEE,
        maxBundleMessages: MAX_BUNDLE_MESSAGES,
      },
    ]

    return SpokeMessageBridge.deploy(hubChainId, defaultRoutes, spokeChainId)
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
    const to = overrides?.to ?? messageReceiver.address
    const data = overrides?.data ?? this.defaults.data

    const bridge = this.bridges[fromChainId.toString()]
    // ToDo: check nonce
    const tx = await bridge
      .connect(fromSigner)
      .sendMessage(toChainId, to, data, {
        value: MESSAGE_FEE,
      })
    const { messageSent, messageBundled, bundleCommitted } =
      await this.getSendMessageEvents(tx)

    const bundleId =
      messageBundled?.bundleId ??
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    const treeIndex = messageBundled?.treeIndex ?? '0'

    const message = new Message(
      bundleId,
      treeIndex,
      fromChainId,
      from,
      toChainId,
      to,
      data
    )

    expect(messageSent.messageId).to.eq(messageSent.messageId)
    expect(from.toLowerCase()).to.eq(messageSent.from.toLowerCase())
    expect(toChainId).to.eq(messageSent.toChainId)
    expect(to.toLowerCase()).to.eq(messageSent.to.toLowerCase())
    expect(data.toString().toLowerCase()).to.eq(messageSent.data.toLowerCase())

    this.messageIds.push(messageSent.messageId)
    this.messages[messageSent.messageId] = message

    let firstConnectionTx
    let secondConnectionTx
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

      // optionally exit the bundle here
      const connectionTxs = await this.relayBundleMessages(
        fromChainId,
        toChainId
      )
      firstConnectionTx = connectionTxs.firstConnectionTx
      secondConnectionTx = connectionTxs.secondConnectionTx
      if (!firstConnectionTx) throw new Error('No messages relayed')
      // ToDo: Check event data from relayReceipt
    }

    return {
      tx,
      firstConnectionTx,
      secondConnectionTx,
      messageSent,
      messageBundled,
      bundleCommitted,
    }
  }

  async getSendMessageEvents(tx: ContractTransaction) {
    const receipt = await tx.wait()

    const messageSentEvent = receipt.events?.find(
      e => e.event === 'MessageSent'
    )
    if (!messageSentEvent?.args) throw new Error('No MessageSent event found')
    const messageSent = {
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

  async relayBundleMessages(
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
    signer?: Signer,
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

    const tree = new MerkleTree(storedBundle.messageIds)
    const proof = tree
      .getProof(messageId)
      .map(node => '0x' + node.data.toString('hex'))

    const treeIndex =
      overrides?.treeIndex ?? storedBundle.messageIds.indexOf(messageId)
    const siblings = overrides?.siblings ?? proof

    // function roundUpPowersOfTwo(num: number) {
    //   let pow = 1
    //   while(num < pow) {
    //     pow *= 2
    //   }
    //   return pow
    // }

    const totalLeaves = overrides?.totalLeaves ?? storedBundle.messageIds.length // ToDo: Is this needed? roundUpPowersOfTwo(storedBundle.messageIds.length)

    let bridge = this.bridges[toChainId.toString()]
    if (signer) {
      bridge = bridge.connect(signer)
    }

    const tx = await bridge.relayMessage(fromChainId, from, to, data, {
      bundleId,
      treeIndex,
      siblings,
      totalLeaves,
    })

    return { tx }
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
}

export default Fixture
