import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import type {
  SpokeMessageBridge as ISpokeMessageBridge,
  HubMessageBridge as IHubMessageBridge,
  MockMessageReceiver as IMessageReceiver,
  FeeDistributor as IFeeDistributor,
  MockConnector as IMockConnector,
} from '../../typechain'

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
  MAX_BUNDLE_FEE,
  MAX_BUNDLE_FEE_BPS
} from '../constants'
import { getSetResultCalldata } from '../utils'
import Fixture, { Defaults } from '../Fixture'

async function deployFixture(
  _hubChainId: BigNumberish,
  _spokeChainIds: BigNumberish[],
  _defaults: Partial<Defaults> = {}
) {
  const hubChainId = BigNumber.from(_hubChainId)
  const spokeChainIds = _spokeChainIds.map(n => BigNumber.from(n))

  // Factories
  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')

  const hubBridge = await deployHubBridge(hubChainId)
  const hubMessageReceiver = await MessageReceiver.deploy(hubBridge.address)

  const spokeBridges: ISpokeMessageBridge[] = []
  const feeDistributors: IFeeDistributor[] = []
  const hubConnectors: IMockConnector[] = []
  const spokeConnectors: IMockConnector[] = []
  const spokeMessageReceivers: IMessageReceiver[] = []
  for (let i = 0; i < spokeChainIds.length; i++) {
    const spokeChainId = spokeChainIds[i]
    const spokeBridge = await deploySpokeBridge(hubChainId, spokeChainId)
    spokeBridges.push(spokeBridge)

    const { feeDistributor, hubConnector, spokeConnector } =
      await connectHubAndSpoke(hubBridge, spokeBridge)

    feeDistributors.push(feeDistributor)
    hubConnectors.push(hubConnector)
    spokeConnectors.push(spokeConnector)

    await hubBridge.setSpokeBridge(
      spokeChainId,
      hubConnector.address,
      ONE_WEEK,
      feeDistributor.address
    )
    spokeBridge.setHubBridge(spokeConnector.address, feeDistributor.address)

    const messageReceiver = await MessageReceiver.deploy(spokeBridge.address)
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

async function deployHubBridge(chainId: BigNumberish) {
  const HubMessageBridge = await ethers.getContractFactory(
    'MockHubMessageBridge'
  )

  return HubMessageBridge.deploy(chainId) as Promise<IHubMessageBridge>
}

async function deploySpokeBridge(
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

  return SpokeMessageBridge.deploy(
    hubChainId,
    defaultRoutes,
    spokeChainId
  ) as Promise<ISpokeMessageBridge>
}

async function connectHubAndSpoke(
  hubBridge: IHubMessageBridge,
  spokeBridge: ISpokeMessageBridge
) {
  const Connector = await ethers.getContractFactory('MockConnector')
  const FeeDistributor = await ethers.getContractFactory('ETHFeeDistributor')

  const hubConnector = await Connector.deploy()
  const spokeConnector = await Connector.deploy()
  await hubConnector.initialize(hubBridge.address, spokeConnector.address)
  await spokeConnector.initialize(spokeBridge.address, hubConnector.address)

  const feeDistributor = await FeeDistributor.deploy(
    hubBridge.address,
    TREASURY,
    PUBLIC_GOODS,
    MIN_PUBLIC_GOODS_BPS,
    FULL_POOL_SIZE,
    MAX_BUNDLE_FEE,
    MAX_BUNDLE_FEE_BPS
  )

  const spokeChainId = await spokeBridge.getChainId()
  await hubBridge.setSpokeBridge(
    spokeChainId,
    hubConnector.address,
    ONE_WEEK,
    feeDistributor.address
  )
  await spokeBridge.setHubBridge(spokeConnector.address, feeDistributor.address)

  return { feeDistributor, hubConnector, spokeConnector }
}

export default deployFixture
