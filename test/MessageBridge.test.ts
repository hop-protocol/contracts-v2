import { expect, use } from 'chai'
import { ContractTransaction, BigNumber, BigNumberish, Signer, providers } from 'ethers'
import { ethers } from 'hardhat'
import {
  ONE_WEEK,
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_RESULT,
  DEFAULT_FROM_CHAIN_ID,
  DEFAULT_TO_CHAIN_ID,
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
import Fixture from './FixtureClass'
import { getMessageId, getSetResultCalldata, getBundleRoot, getBundleId } from './utils'

describe('MessageBridge', function () {
  describe('sendMessage', function () {
    it('Should call contract Spoke to Hub', async function () {
      const [deployer, sender, relayer] = await ethers.getSigners()
      const data = await getSetResultCalldata(DEFAULT_RESULT)

      const { fixture, hubBridge } = await Fixture.deploy(HUB_CHAIN_ID, [
        SPOKE_CHAIN_ID_0,
        SPOKE_CHAIN_ID_1,
      ])

      const {
        tx: sendTx,
        messageSent: { messageId: messageId0 },
      } = await fixture.sendMessage(sender)
      await logGas('sendMessage()', sendTx)

      await fixture.sendMessage(sender)

      const { tx: relayTx } = await fixture.relayMessage(messageId0)
      await logGas('relayMessage()', relayTx)

      const messageReceiver = fixture.getMessageReceiver()

      const result = await messageReceiver.result()
      expect(DEFAULT_RESULT).to.eq(result)

      const msgSender = await messageReceiver.msgSender()
      expect(hubBridge.address).to.eq(msgSender)

      const xDomainSender = await messageReceiver.xDomainSender()
      expect(sender.address).to.eq(xDomainSender)

      const xDomainChainId = await messageReceiver.xDomainChainId()
      expect(DEFAULT_FROM_CHAIN_ID).to.eq(xDomainChainId)

      const feeDistributor = fixture.getFeeDistributor()
      const expectedFeeDistributorBalance = BigNumber.from(MESSAGE_FEE).mul(2)
      const feeDistributorBalance = await provider.getBalance(
        feeDistributor.address
      )
      expect(expectedFeeDistributorBalance).to.eq(feeDistributorBalance)
    })

    // with large data
    // with empty data
    it('Should call contract Spoke to Hub', async function () {})
    it('Should call contract Hub to Spoke', async function () {})
    it('Should call contract Spoke to Spoke', async function () {})

    // non-happy path
    // with hub
    // with spoke
    it('It should revert if toChainId is not supported', async function () {})

    // just hub
    it('It should revert if to is a spoke bridge', async function () {})
    // just spoke
    it('It should revert if to is a hub bridge', async function () {})
  })

  describe('relayMessage', function () {
    it('Should not allow invalid nonce', async function () {})
    it('Should not allow invalid fromChainId', async function () {})
    it('Should not allow invalid from', async function () {})
    it('Should not allow invalid to', async function () {})
    it('Should not allow invalid data', async function () {})
    // BundleProof
    it('Should not allow invalid bundleId', async function () {})
    it('Should not allow invalid treeIndex', async function () {})
    it('Should not allow invalid siblings', async function () {})
    it('Should not allow extra siblings', async function () {})
    it('Should not allow empty siblings for non single element tree', async function () {})
    it('Should not allow totalLeaves + 1', async function () {})
    it('Should not allow totalLeaves - 1', async function () {})
    it('Should not allow 0', async function () {})

    it('Should not allow the same message to be relayed twice', async function () {})
  })

  describe('getXDomainChainId', function () {
    it('Should revert when called directly', async function () {})
  })

  describe('getXDomainSender', function () {
    it('Should revert when called directly', async function () {})
  })

  describe('getChainId', function () {
    it('Should return the chainId', async function () {})
  })
})

// function getMessageId(
//   nonce: BigNumberish,
//   fromChainId: BigNumberish,
//   from: string,
//   toChainId: BigNumberish,
//   to: string,
//   message: string
// ) {
//   return keccak256(
//     abi.encode(
//       ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes'],
//       [nonce, fromChainId, from, toChainId, to, message]
//     )
//   )
// }

// async function getSetResultCalldata(result: BigNumberish): Promise<string> {
//   const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')
//   const message = MessageReceiver.interface.encodeFunctionData('setResult', [
//     result,
//   ])
//   return message
// }

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
