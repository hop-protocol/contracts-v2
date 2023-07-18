import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import type {
  SpokeTransporter as ISpokeTransporter,
  HubTransporter as IHubTransporter,
  MockConnector as IMockConnector,
} from '../../typechain'

import {
  ONE_WEEK,
  TREASURY,
  FULL_POOL_SIZE,
  DEFAULT_FROM_CHAIN_ID,
  DEFAULT_TO_CHAIN_ID,
  DEFAULT_COMMITMENT,
  MAX_TRANSPORT_FEE_ABSOLUTE,
  MAX_TRANSPORT_FEE_BPS,
  RELAY_WINDOW
} from '@hop-protocol/shared/constants'
import Fixture, { Defaults } from './index'

async function deployFixture(
  _hubChainId: BigNumberish,
  _spokeChainIds: BigNumberish[],
  _defaults: Partial<Defaults> = {}
) {
  const hubChainId = BigNumber.from(_hubChainId)
  const spokeChainIds = _spokeChainIds.map(n => BigNumber.from(n))

  const hubTransporter = await deployHubTransporter(
    TREASURY,
    FULL_POOL_SIZE,
    0,
    RELAY_WINDOW,
    MAX_TRANSPORT_FEE_ABSOLUTE,
    MAX_TRANSPORT_FEE_BPS,
    _hubChainId
  )

  const spokeTransporters: ISpokeTransporter[] = []
  const hubConnectors: IMockConnector[] = []
  const spokeConnectors: IMockConnector[] = []
  for (let i = 0; i < spokeChainIds.length; i++) {
    const spokeChainId = spokeChainIds[i]
    const spokeTransporter = await deploySpokeTransporter(hubChainId, spokeChainId)
    spokeTransporters.push(spokeTransporter)

    const { hubSideConnector, spokeSideConnector } =
      await connectHubAndSpoke(hubTransporter, spokeTransporter)

    hubConnectors.push(hubSideConnector)
    spokeConnectors.push(spokeSideConnector)

    await hubTransporter.setSpokeConnector(
      spokeChainId,
      hubSideConnector.address,
      ONE_WEEK
    )
    spokeTransporter.setHubConnector(spokeSideConnector.address)
  }

  const defaultDefaults: Defaults = {
    fromChainId: DEFAULT_FROM_CHAIN_ID,
    toChainId: DEFAULT_TO_CHAIN_ID,
    commitment: DEFAULT_COMMITMENT
  }

  const defaults = Object.assign(defaultDefaults, _defaults)

  const fixture = new Fixture(
    hubChainId,
    hubTransporter,
    spokeChainIds,
    spokeTransporters,
    hubConnectors,
    spokeConnectors,
    defaults
  )

  return { fixture, hubTransporter, spokeTransporters }
}

async function deployHubTransporter(
  excessFeesRecipient: string,
  targetBalance: BigNumberish,
  pendingFeeBatchSize: BigNumberish,
  relayWindow: BigNumberish,
  absoluteMaxFee: BigNumberish,
  maxFeeBPS: BigNumberish,
  chainId: BigNumberish
) {
  const HubTransporter = await ethers.getContractFactory(
    'MockHubTransporter'
  )

  return HubTransporter.deploy(
    relayWindow,
    absoluteMaxFee,
    maxFeeBPS,
    chainId
  ) as Promise<IHubTransporter>
}

async function deploySpokeTransporter(
  hubChainId: BigNumberish,
  spokeChainId: BigNumberish
) {
  const SpokeTransporter = await ethers.getContractFactory(
    'MockSpokeTransporter'
  )

  return SpokeTransporter.deploy(
    hubChainId,
    0,
    spokeChainId
  ) as Promise<ISpokeTransporter>
}

async function connectHubAndSpoke(
  hubTransporter: IHubTransporter,
  spokeTransporter: ISpokeTransporter
) {
  const Connector = await ethers.getContractFactory('MockConnector')

  const hubSideConnector = await Connector.deploy()
  const spokeSideConnector = await Connector.deploy()
  await hubSideConnector.initialize(hubTransporter.address, spokeSideConnector.address)
  await spokeSideConnector.initialize(spokeTransporter.address, hubSideConnector.address)

  const spokeChainId = await spokeTransporter.getChainId()
  await hubTransporter.setSpokeConnector(
    spokeChainId,
    hubSideConnector.address,
    ONE_WEEK
  )
  await spokeTransporter.setHubConnector(spokeSideConnector.address)

  return { hubSideConnector, spokeSideConnector }
}

export default deployFixture
