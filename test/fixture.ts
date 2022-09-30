import { ethers } from 'hardhat'
import type {
  SpokeMessageBridge as ISpokeMessageBridge,
  FeeDistributor as IFeeDistributor,
} from '../typechain'
import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
} from './constants'
import { SpokeBridge, HubBridge } from './Bridge'

async function fixture(hubChainId: number, spokeChainIds: number[]) {
  // Factories
  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')
  const FeeDistributor = await ethers.getContractFactory('ETHFeeDistributor')

  // Deploy
  const hubBridge = await HubBridge.deploy({ chainId: hubChainId })
  const spokeBridges: SpokeBridge[] = []
  const feeDistributors: IFeeDistributor[] = []
  for (let i = 0; i < spokeChainIds.length; i++) {
    const feeDistributor = await FeeDistributor.deploy(
      hubBridge.address,
      TREASURY,
      PUBLIC_GOODS,
      MIN_PUBLIC_GOODS_BPS,
      FULL_POOL_SIZE
    )

    const spokeChainId = spokeChainIds[i]
    const spokeBridge = await SpokeBridge.deploy(
      hubChainId,
      hubBridge,
      feeDistributor,
      { chainId: spokeChainId }
    )

    await hubBridge.setSpokeBridge(
      spokeChainId,
      spokeBridge.address,
      ONE_WEEK,
      feeDistributor.address
    )

    spokeBridges.push(spokeBridge)
    feeDistributors.push(feeDistributor)
  }

  const messageReceiver = await MessageReceiver.deploy(hubBridge.address)

  return { hubBridge, spokeBridges, feeDistributors, messageReceiver }
}

export default fixture
