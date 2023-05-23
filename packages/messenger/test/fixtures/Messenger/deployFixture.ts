import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'

import TransporterFixture from '../Transporter'

import type {
  Dispatcher as IDispatcher,
  Executor as IExecutor,
  VerificationManager as IVerificationManager,
  MockMessageReceiver as IMessageReceiver,
} from '../../../typechain'
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
} from '../../utils/constants'
import { getSetResultCalldata } from '../../utils/utils'
import Fixture, { Defaults } from '.'

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

async function deployFixture(
  _hubChainId: BigNumberish,
  _spokeChainIds: BigNumberish[],
  _defaults: Partial<Defaults> = {}
) {
  const hubChainId = BigNumber.from(_hubChainId)
  const spokeChainIds = _spokeChainIds.map(n => BigNumber.from(n))
  const chainIds = spokeChainIds.concat(hubChainId)

  const {
    fixture: transporterFixture
  } = await TransporterFixture.deploy(hubChainId, spokeChainIds)

  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')

  const dispatchers: IDispatcher[] = []
  const executors: IExecutor[] = []
  const verificationManagers: IVerificationManager[] = []
  const messageReceivers: IMessageReceiver[] = []
  for (let i = 0; i < chainIds.length; i++) {
    const chainId = chainIds[i]
    const transporter = transporterFixture.transporters[chainId.toString()]

    const {
      dispatcher,
      verificationManager,
      executor
    } = await deploy(chainId, transporter.address)
    dispatchers.push(dispatcher)
    executors.push(executor)
    verificationManagers.push(verificationManager)

    const messageReceiver = await MessageReceiver.deploy(executor.address)
    messageReceivers.push(messageReceiver)
  }

  const defaultDefaults: Defaults = {
    fromChainId: DEFAULT_FROM_CHAIN_ID,
    toChainId: DEFAULT_TO_CHAIN_ID,
    data: await getSetResultCalldata(DEFAULT_RESULT),
  }

  const defaults = Object.assign(defaultDefaults, _defaults)

  const fixture = new Fixture(
    chainIds,
    dispatchers,
    executors,
    verificationManagers,
    messageReceivers,
    transporterFixture,
    defaults
  )

  return {
    fixture,
    transporterFixture,
    dispatchers,
    executors,
    verificationManagers,
    messageReceivers
  }
}

async function deploy(
  chainId: BigNumberish,
  transporter: string
) {
  const Dispatcher = await ethers.getContractFactory('MockDispatcher')
  const Executor = await ethers.getContractFactory('MockExecutor')
  const VerificationManager = await ethers.getContractFactory('MockVerificationManager')

  const dispatcher = await Dispatcher.deploy(
    transporter,
    defaultRoutes,
    chainId
  ) as IDispatcher

  const verificationManager = await VerificationManager.deploy(transporter, chainId) as IVerificationManager
  const executor = await Executor.deploy(verificationManager.address, chainId) as IExecutor

  return { dispatcher, verificationManager, executor }
}

export default deployFixture
