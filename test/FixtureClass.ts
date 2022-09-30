import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
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
  getBundleId,
} from './utils'

export type Defaults =  {
  fromChainId: BigNumber
  toChainId: BigNumber
  data: string
}

class Fixture {
  hubChainId: BigNumber
  hubBridge: HubBridge
  spokeChainIds: BigNumber[]
  spokeBridges: SpokeBridge[]
  bridges: { [key: string]: Bridge }
  messageReceivers: { [key: string]: IMessageReceiver }
  feeDistributors: { [key: string]: IFeeDistributor }
  defaults: Defaults

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

    const defaults = Object.assign(_defaults, defaultDefaults)

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
    overrides?: {
      fromChainId: BigNumberish
      toChainId: BigNumberish
      to: string
      data: BytesLike
    }
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

    const expectedMessageId = getMessageId(
      res.nonce,
      fromChainId,
      from,
      toChainId,
      to,
      data
    )

    expect(expectedMessageId).to.eq(res.messageId)
    expect(from.toLowerCase()).to.eq(res.from.toLowerCase())
    expect(toChainId).to.eq(res.toChainId)
    expect(to.toLowerCase()).to.eq(res.to.toLowerCase())
    expect(data.toString().toLowerCase()).to.eq(res.data.toLowerCase())

    return res
  }

  getMessageReceiver(chainId?: BigNumberish) {
    chainId = chainId ? BigNumber.from(chainId) : this.defaults.toChainId
    return this.messageReceivers[chainId.toString()]
  }

  getFeeDistributor(chainId?: BigNumberish) {
    chainId = chainId ? BigNumber.from(chainId) : SPOKE_CHAIN_ID_0
    return this.feeDistributors[chainId.toString()]
  }

  getBundleId(
    bundleRoot: string,
    overrides?: {
      fromChainId: BigNumberish
      toChainId: BigNumberish
    }
  ) {
    const fromChainId = overrides?.fromChainId ?? this.defaults.fromChainId
    const toChainId = overrides?.toChainId ?? this.defaults.toChainId
    return getBundleId(bundleRoot, fromChainId, toChainId)
  }
}

export default Fixture
