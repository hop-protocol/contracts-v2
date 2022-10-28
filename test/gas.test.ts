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
  ARBITRARY_EOA,
} from './constants'
import Bridge, { SpokeBridge, HubBridge } from './Bridge'
type Provider = providers.Provider
const { provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils
import Fixture from './Fixture'
import { getSetResultCalldata, getBundleRoot } from './utils'

describe('MessageBridge Gas Profile', function () {
  it('Should sendMessage L1 -> L2', async function () {
    console.log('    Send message L1 -> L2')
    const [sender] = await ethers.getSigners()

    const { fixture } = await Fixture.deploy(
      HUB_CHAIN_ID,
      [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
      {
        fromChainId: HUB_CHAIN_ID,
        toChainId: SPOKE_CHAIN_ID_0,
      }
    )

    await fixture.sendMessage(sender)
    await fixture.sendMessage(sender)

    const {
      tx: sendTx,
      messageSent: { messageId: messageId0 },
    } = await fixture.sendMessage(sender, { to: ARBITRARY_EOA })
    await logGas('sendMessage()', sendTx)

    const { tx: sendAndCommitTx } = await fixture.sendMessage(sender)
    // await logGas('sendMessage() with commit', sendAndCommitTx)
  })

  it('Should sendMessage L2 -> L1', async function () {
    console.log('    Send message L2 -> L1')
    const [sender] = await ethers.getSigners()

    const { fixture } = await Fixture.deploy(HUB_CHAIN_ID, [
      SPOKE_CHAIN_ID_0,
      SPOKE_CHAIN_ID_1,
    ])

    await fixture.sendMessage(sender)
    await fixture.sendMessage(sender)

    const {
      tx: sendTx,
      messageSent: { messageId: messageId0 },
    } = await fixture.sendMessage(sender, { to: ARBITRARY_EOA })
    await logGas('sendMessage()', sendTx)

    const {
      tx: sendAndCommitTx,
      messageSent: { messageId: messageId1 },
    } = await fixture.sendMessage(sender, { to: ARBITRARY_EOA })
    // await logGas('sendMessage() with commit', sendAndCommitTx)

    const { tx: relayTx0 } = await fixture.relayMessage(messageId0)
    await logGas('relayMessage()', relayTx0)

    const { tx: relayTx1 } = await fixture.relayMessage(messageId1, undefined, { treeIndex: 1 })
    // await logGas('relayMessage()', relayTx1)
  })

  it('Should sendMessage L2 -> L2', async function () {
    console.log('    Send message L2 -> L2')
    const [sender] = await ethers.getSigners()

    const { fixture } = await Fixture.deploy(
      HUB_CHAIN_ID,
      [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
      {
        fromChainId: SPOKE_CHAIN_ID_0,
        toChainId: SPOKE_CHAIN_ID_1,
      }
    )

    await fixture.sendMessage(sender)
    await fixture.sendMessage(sender)

    const {
      tx: sendTx,
      messageSent: { messageId: messageId0 },
    } = await fixture.sendMessage(sender, { to: ARBITRARY_EOA })
    await logGas('sendMessage()', sendTx)

    const {
      tx: sendAndCommitTx,
      messageSent: { messageId: messageId1 },
    } = await fixture.sendMessage(sender, { to: ARBITRARY_EOA })
    // await logGas('sendMessage() with commit', sendAndCommitTx)

    const { tx: relayTx0 } = await fixture.relayMessage(messageId0)
    await logGas('relayMessage()', relayTx0)

    const { tx: relayTx1 } = await fixture.relayMessage(messageId1)
    // await logGas('relayMessage()', relayTx1)
  })
})

async function logGas(
  txName: string,
  tx: ContractTransaction
): Promise<ContractTransaction> {
  const receipt = await tx.wait()
  const gasUsed = receipt.cumulativeGasUsed
  const { calldataBytes, calldataCost } = getCalldataStats(tx.data)
  console.log(`      ${txName}
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
