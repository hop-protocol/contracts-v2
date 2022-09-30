import { expect, use } from 'chai'
import { ContractTransaction, BigNumber, BigNumberish, Signer, providers } from 'ethers'
import { ethers } from 'hardhat'
import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID,
  RESULT,
  MESSAGE_FEE,
  MAX_BUNDLE_MESSAGES,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
} from './constants'
import Bridge, { SpokeBridge, HubBridge } from './Bridge'
type Provider = providers.Provider
const { provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils
import fixture from './fixture'

describe('contracts', function () {
  it('Should call contract Spoke to Hub', async function () {
    const [deployer, sender, relayer] = await ethers.getSigners()
    const data = await getSetResultCalldata(RESULT)

    const { hubBridge, spokeBridges, feeDistributors, messageReceiver } =
      await fixture(HUB_CHAIN_ID, [SPOKE_CHAIN_ID])

    const spokeBridge = spokeBridges[0]
    const feeDistributor = feeDistributors[0]

    console.log(`Hub Bridge: ${hubBridge.address}`)
    console.log(`Spoke Bridge: ${spokeBridge.address}`)
    console.log(`Message Receiver: ${messageReceiver.address}`)

    // Send message and commit bundle
    const fromChainId = SPOKE_CHAIN_ID
    const fromAddress = sender.address
    const toChainId = HUB_CHAIN_ID
    const toAddress = messageReceiver.address
    const messageFee = MESSAGE_FEE

    const { messageId: messageId1, nonce: nonce1 } = await spokeBridge
      .connect(sender)
      .sendMessage(toChainId, toAddress, data)

    const { messageId: messageId2 } = await spokeBridge
      .connect(sender)
      .sendMessage(toChainId, toAddress, data)

    const bundleRoot = solidityKeccak256(
      ['bytes32', 'bytes32'],
      [messageId1, messageId2]
    )

    const bundleId = solidityKeccak256(
      ['uint256', 'uint256', 'bytes32'],
      [fromChainId, toChainId, bundleRoot]
    )

    // Relay message
    const tx = await hubBridge.relayMessage(
      nonce1,
      fromChainId,
      sender.address,
      toAddress,
      data,
      {
        bundleId,
        treeIndex: 0,
        siblings: [messageId2],
        totalLeaves: 2,
      }
    )

    await logGas('relayMessage()', tx)

    const result = await messageReceiver.result()
    expect(RESULT).to.eq(result)

    const msgSender = await messageReceiver.msgSender()
    expect(hubBridge.address).to.eq(msgSender)

    const xDomainSender = await messageReceiver.xDomainSender()
    expect(sender.address).to.eq(xDomainSender)

    const xDomainChainId = await messageReceiver.xDomainChainId()
    expect(SPOKE_CHAIN_ID).to.eq(xDomainChainId)

    const expectedFeeDistributorBalance = BigNumber.from(MESSAGE_FEE).mul(2)
    const feeDistributorBalance = await provider.getBalance(
      feeDistributor.address
    )
    expect(expectedFeeDistributorBalance).to.eq(feeDistributorBalance)
  })
})

function getMessageId(
  nonce: BigNumberish,
  fromChainId: BigNumberish,
  from: string,
  toChainId: BigNumberish,
  to: string,
  message: string
) {
  return keccak256(
    abi.encode(
      ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes'],
      [nonce, fromChainId, from, toChainId, to, message]
    )
  )
}

async function getSetResultCalldata(result: BigNumberish): Promise<string> {
  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')
  const message = MessageReceiver.interface.encodeFunctionData('setResult', [
    result,
  ])
  return message
}

async function logGas(
  txName: string,
  tx: ContractTransaction
): Promise<ContractTransaction> {
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
