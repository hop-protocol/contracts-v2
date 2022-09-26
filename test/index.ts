import { expect, use } from 'chai'
import { ContractTransaction, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import type {
  SpokeMessageBridge as ISpokeMessageBridge,
  FeeDistributor as IFeeDistributor
} from '../typechain'

const { BigNumber, provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils

const ONE_WEEK = 604800
const HUB_CHAIN_ID = 1111
const SPOKE_CHAIN_ID = 1112
const RESULT = 12345
const MESSAGE_FEE = 100
const MAX_BUNDLE_MESSAGES = 2
const TREASURY = '0x1111000000000000000000000000000000001111'
const PUBLIC_GOODS = '0x2222000000000000000000000000000000002222'
const MIN_PUBLIC_GOODS_BPS = 100_000
const FULL_POOL_SIZE = 100000

describe('contracts', function () {
  it('Should call contract Spoke to Hub', async function () {
    const [deployer, sender, relayer] = await ethers.getSigners()
    const message = await getSetResultCalldata(RESULT)

    const { hubBridge, spokeBridges, feeDistributors, messageReceiver } = await fixture(
      HUB_CHAIN_ID,
      [SPOKE_CHAIN_ID]
    )
    const spokeBridge = spokeBridges[0]
    const feeDistributor = feeDistributors[0]

    console.log(`Hub Bridge: ${hubBridge.address}`)
    console.log(`Spoke Bridge: ${spokeBridge.address}`)
    console.log(`Message Receiver: ${messageReceiver.address}`)

    const toAddress = messageReceiver.address

    // Send message and commit bundle
    const messageNonce1 = await spokeBridge.messageNonce()
    await logGas(
      'sendMessage()',
      spokeBridge
        .connect(sender)
        .sendMessage(HUB_CHAIN_ID, toAddress, message, {
          value: MESSAGE_FEE,
        })
    )

    const messageNonce2 = await spokeBridge.messageNonce()
    await spokeBridge
      .connect(sender)
      .sendMessage(HUB_CHAIN_ID, toAddress, message, {
        value: MESSAGE_FEE,
      })

    // ToDo: Get messageId, bundleId from events
    const messageId1 = getMessageId(
      messageNonce1,
      SPOKE_CHAIN_ID,
      sender.address,
      toAddress,
      message
    )

    const messageId2 = getMessageId(
      messageNonce2,
      SPOKE_CHAIN_ID,
      sender.address,
      toAddress,
      message
    )

    const bundleRoot = solidityKeccak256(
      ['bytes32', 'bytes32'],
      [messageId1, messageId2]
    )

    const bundleId = solidityKeccak256(
      ['uint256', 'uint256', 'bytes32'],
      [SPOKE_CHAIN_ID, HUB_CHAIN_ID, bundleRoot]
    )

    // Relay message
    await logGas(
      'relayMessage()',
      hubBridge.relayMessage(
        {
          nonce: messageNonce1,
          fromChainId: SPOKE_CHAIN_ID,
          from: sender.address,
          to: toAddress,
          data: message,
        },
        bundleId,
        0,
        [messageId2],
        2
      )
    )

    const res = await messageReceiver.result()
    const feeDistributorBalance = await provider.getBalance(
      feeDistributor.address
    )
    expect(res).to.eq(RESULT)
    const expectedFeeDistributorBalance = BigNumber.from(MESSAGE_FEE).mul(2)
    expect(expectedFeeDistributorBalance).to.eq(feeDistributorBalance)
  })
})

function getMessageId(
  nonce: BigNumberish,
  fromChainId: BigNumberish,
  from: string,
  to: string,
  message: string
) {
  return keccak256(
    abi.encode(
      ['uint256', 'uint256', 'address', 'address', 'bytes'],
      [nonce, fromChainId, from, to, message]
    )
  )
}

async function fixture(hubChainId: number, spokeChainIds: number[]) {
  // Factories
  const HubMessageBridge = await ethers.getContractFactory(
    'MockHubMessageBridge'
  )
  const SpokeMessageBridge = await ethers.getContractFactory(
    'MockSpokeMessageBridge'
  )
  const MessageReceiver = await ethers.getContractFactory('MessageReceiver')
  const FeeDistributor = await ethers.getContractFactory('FeeDistributor')

  // Deploy
  const hubBridge = await HubMessageBridge.deploy(hubChainId)
  const spokeBridges: ISpokeMessageBridge[] = []
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
    const spokeBridge = await SpokeMessageBridge.deploy(
      hubBridge.address,
      feeDistributor.address,
      [
        {
          chainId: hubChainId,
          messageFee: MESSAGE_FEE,
          maxBundleMessages: MAX_BUNDLE_MESSAGES,
        },
      ],
      SPOKE_CHAIN_ID
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

  const messageReceiver = await MessageReceiver.deploy()

  return { hubBridge, spokeBridges, feeDistributors, messageReceiver }
}

async function getSetResultCalldata(result: BigNumberish): Promise<string> {
  const MessageReceiver = await ethers.getContractFactory('MessageReceiver')
  const message = MessageReceiver.interface.encodeFunctionData('setResult', [
    result,
  ])
  return message
}

async function logGas(
  txName: string,
  txPromise: Promise<ContractTransaction>
): Promise<ContractTransaction> {
  const tx = await txPromise
  const receipt = await tx.wait()
  const gasUsed = receipt.cumulativeGasUsed
  const { calldataBytes, calldataCost } = getCalldataStats(tx.data)
  console.log(`    ${txName}
      gasUsed: ${gasUsed.toString()}
      calldataCost: ${calldataCost}
      calldataBytes: ${calldataBytes}`)
  return tx
}

function getCalldataStats(calldata: string) {
  let data = calldata
  if (calldata.slice(0, 2) === '0x') {
    data = calldata.slice(2)
  }
  const calldataBytes = data.length / 2

  let zeroBytes = 0
  for (let i = 0; i < calldataBytes; i = i + 2) {
    const byte = data.slice(i, i + 2)
    if (byte === '00') {
      zeroBytes++
    }
  }
  const nonZeroBytes = calldataBytes - zeroBytes

  const calldataCost = zeroBytes * 4 + nonZeroBytes * 16
  return { calldataBytes, calldataCost }
}
