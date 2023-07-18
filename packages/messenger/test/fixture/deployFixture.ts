import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import TransporterFixture from '../Transporter'
import getSetResultCalldata from '../../../shared/utils/getSetResultCalldata'
import type {
  Dispatcher as IDispatcher,
  ExecutorManager as IExecutorManager,
  MockMessageReceiver as IMessageReceiver,
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
  const chainIds = [hubChainId].concat(spokeChainIds)

  const {
    fixture: transporterFixture
  } = await TransporterFixture.deploy(hubChainId, spokeChainIds)

  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')

  const dispatchers: IDispatcher[] = []
  const executors: IExecutorManager[] = []
  const messageReceivers: IMessageReceiver[] = []
  for (let i = 0; i < chainIds.length; i++) {
    const chainId = chainIds[i]
    const transporter = transporterFixture.transporters[chainId.toString()]

    const { dispatcher, executor } = await deploy(chainId, transporter.address)
    dispatchers.push(dispatcher)
    executors.push(executor)

    const executorHead = await executor.head()
    const messageReceiver = await MessageReceiver.deploy(executorHead)
    messageReceivers.push(messageReceiver)
  }

  await transporterFixture.setDispatchers(
    dispatchers[0].address,
    dispatchers.slice(1).map(d => d.address)
  )

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
    messageReceivers,
    transporterFixture,
    defaults
  )

  return {
    fixture,
    transporterFixture,
    dispatchers,
    executors,
    messageReceivers
  }
}

async function deploy(
  chainId: BigNumberish,
  transporter: string
) {
  const Dispatcher = await ethers.getContractFactory('MockDispatcher')
  const ExecutorManger = await ethers.getContractFactory('MockExecutorManager')

  const dispatcher = await Dispatcher.deploy(
    transporter,
    defaultRoutes,
    chainId
  ) as IDispatcher

  const executor = await ExecutorManger.deploy(transporter, chainId) as IExecutorManager

  return { dispatcher, executor }
}

export default deployFixture
