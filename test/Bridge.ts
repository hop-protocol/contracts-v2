import { providers, BigNumber, BigNumberish, Signer, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
import type {
  FeeDistributor as IFeeDistributor,
  MessageBridge as IMessageBridge,
  SpokeMessageBridge as ISpokeMessageBridge,
  HubMessageBridge as IHubMessageBridge,
} from '../typechain'
import { 
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_RESULT,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
} from './constants'
type Provider = providers.Provider

export type Options = Partial<{ shouldLogGas: boolean }>

type Route = {
  chainId: BigNumberish
  messageFee: BigNumberish
  maxBundleMessages: BigNumberish
}

export default class Bridge {
  bridge: IMessageBridge

  get address() {
    return this.bridge.address
  }

  get getChainId() {
    return this.bridge.getChainId
  }

  get relayMessage() {
    return this.bridge.relayMessage
  }

  get connect(): (signerOrProvider: string | Signer | Provider) => Bridge {
    return (signerOrProvider: string | Signer | Provider) =>
      new Bridge(this.bridge.connect(signerOrProvider))
  }

  constructor(_bridge: IMessageBridge) {
    this.bridge = _bridge
  }

  async sendMessage(toChainId: BigNumberish, to: string, data: BytesLike) {
    const bridge = this.bridge

    const tx = await bridge.sendMessage(toChainId, to, data, {
      value: MESSAGE_FEE,
    })

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
      tx,
      messageSent,
      messageBundled,
      bundleCommitted,
    }
  }

  static getRandomChainId(): BigNumberish {
    return BigNumber.from(Math.floor(Math.random() * 1000000))
  }
}

export class SpokeBridge extends Bridge {
  bridge: ISpokeMessageBridge

  constructor(_bridge: ISpokeMessageBridge) {
    super(_bridge)
    this.bridge = _bridge
  }

  static async deploy(
    hubChainId: BigNumberish,
    hubBridge: HubBridge,
    hubFeeDistributor: IFeeDistributor,
    overrides: Partial<{
      routes: Route[]
      chainId: BigNumberish
    }> = {}
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

    const defaultParams = {
      routes: defaultRoutes,
      chainId: this.getRandomChainId(),
    }
    const fullParams = Object.assign(defaultParams, overrides)

    const spokeMessageBridge = await SpokeMessageBridge.deploy(
      hubChainId,
      hubBridge.address,
      hubFeeDistributor.address,
      fullParams.routes,
      fullParams.chainId
    )

    return new SpokeBridge(spokeMessageBridge)
  }
}

export class HubBridge extends Bridge {
  bridge: IHubMessageBridge

  get setSpokeBridge() {
    return this.bridge.setSpokeBridge
  }

  constructor(_bridge: IHubMessageBridge) {
    super(_bridge)
    this.bridge = _bridge
  }

  static async deploy(overrides: Partial<{ chainId: BigNumberish }> = {}) {
    const HubMessageBridge = await ethers.getContractFactory(
      'MockHubMessageBridge'
    )

    const defaultParams = { chainId: this.getRandomChainId() }
    const fullParams = Object.assign(defaultParams, overrides)

    const hubMessageBridge = await HubMessageBridge.deploy(fullParams.chainId)

    return new HubBridge(hubMessageBridge)
  }
}
