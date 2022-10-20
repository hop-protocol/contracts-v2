import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils
import type {
  MockMessageReceiver as IMessageReceiver,
  SpokeMessageBridge as ISpokeMessageBridge,
  FeeDistributor as IFeeDistributor,
} from '../typechain'
import Bridge, { HubBridge, SpokeBridge } from './Bridge'
import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
  DEFAULT_FROM_CHAIN_ID,
  DEFAULT_TO_CHAIN_ID,
  DEFAULT_RESULT
} from './constants'
import {
  getMessageId,
  getSetResultCalldata,
  getBundleRoot,
} from './utils'

export type Defaults =  {
  fromChainId: BigNumber
  toChainId: BigNumber
  data: string
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
  hubBridge: HubBridge
  spokeChainIds: BigNumber[]
  spokeBridges: SpokeBridge[]
  bridges: { [key: string]: Bridge }
  messageReceivers: { [key: string]: IMessageReceiver }
  feeDistributors: { [key: string]: IFeeDistributor }
  defaults: Defaults

  // dynamic state
  messageIds: string[]
  messages: { [key: string]: Message }
  messageIdsToBundleIds: { [key: string]: string }
  bundleIds: string[]
  bundles: { [key: string]: {
    bundleId: string
    messageIds: string[]
    bundleRoot: string
    fromChainId: BigNumber
    toChainId: BigNumber
    bundleFees: BigNumber
  } }

  constructor(
    _hubChainId: BigNumber,
    _hubBridge: HubBridge,
    _hubMessageReceiver: IMessageReceiver,
    _spokeChainIds: BigNumber[],
    _spokeBridges: SpokeBridge[],
    _feeDistributors: IFeeDistributor[],
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

    const bridges: { [key: string]: Bridge } = {
      [_hubChainId.toString()]: _hubBridge,
    }
    const messageReceivers = {
      [_hubChainId.toString()]: _hubMessageReceiver,
    }

    const feeDistributors: { [key: string]: IFeeDistributor } = {}

    for (let i = 0; i < _spokeChainIds.length; i++) {
      const spokeChainId = _spokeChainIds[i].toString()
      bridges[spokeChainId] = _spokeBridges[i]
      messageReceivers[spokeChainId] = _spokeMessageReceivers[i]
      feeDistributors[spokeChainId] = _feeDistributors[i]
    }
    this.bridges = bridges
    this.messageReceivers = messageReceivers
    this.feeDistributors = feeDistributors

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

    const hubBridge = await HubBridge.deploy({ chainId: hubChainId })
    const hubMessageReceiver = await MessageReceiver.deploy(hubBridge.address)

    const spokeBridges: SpokeBridge[] = []
    const feeDistributors: IFeeDistributor[] = []
    const spokeMessageReceivers: IMessageReceiver[] = []
    for (let i = 0; i < spokeChainIds.length; i++) {
      const feeDistributor = await FeeDistributor.deploy(
        hubBridge.address,
        TREASURY,
        PUBLIC_GOODS,
        MIN_PUBLIC_GOODS_BPS,
        FULL_POOL_SIZE
      )
      feeDistributors.push(feeDistributor)

      const spokeChainId = spokeChainIds[i]
      const spokeBridge = await SpokeBridge.deploy(
        hubChainId,
        hubBridge,
        feeDistributor,
        { chainId: spokeChainId }
      )
      spokeBridges.push(spokeBridge)

      await hubBridge.setSpokeBridge(
        spokeChainId,
        spokeBridge.address,
        ONE_WEEK,
        feeDistributor.address
      )

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
      spokeMessageReceivers,
      defaults
    )

    return { fixture, hubBridge, spokeBridges, feeDistributors }
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
    const res = await bridge
      .connect(fromSigner)
      .sendMessage(toChainId, to, data)
    const { messageSent, messageBundled, bundleCommitted } = res
    const bundleId = messageBundled?.bundleId ?? '0x0000000000000000000000000000000000000000000000000000000000000000'
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
    const expectedMessageId = message.getMessageId()

    // expect(expectedMessageId).to.eq(messageSent.messageId)
    expect(from.toLowerCase()).to.eq(messageSent.from.toLowerCase())
    expect(toChainId).to.eq(messageSent.toChainId)
    expect(to.toLowerCase()).to.eq(messageSent.to.toLowerCase())
    expect(data.toString().toLowerCase()).to.eq(messageSent.data.toLowerCase())

    this.messageIds.push(messageSent.messageId)
    this.messages[messageSent.messageId] = message

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
    }

    return res
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
