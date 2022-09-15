import { expect, use } from 'chai'
import { ethers } from 'hardhat'

type BigNumberish = typeof ethers.BigNumber | string | number
const { BigNumber, provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils

const ONE_WEEK = 604800

describe('contracts', function () {
  it('Should call contract Spoke to Hub', async function () {
    const HUB_CHAIN_ID = 1111
    const SPOKE_CHAIN_ID = 1112
    const [deployer, sender, relayer] = await ethers.getSigners()

    const MessageReceiver = await ethers.getContractFactory('MessageReceiver')
    const messageReceiver = await MessageReceiver.deploy()

    const HubMessageBridge = await ethers.getContractFactory(
      'MockHubMessageBridge'
    )
    const SpokeMessageBridge = await ethers.getContractFactory(
      'MockSpokeMessageBridge'
    )

    // Setup
    const hubBridge = await HubMessageBridge.deploy(HUB_CHAIN_ID)
    const spokeBridge = await SpokeMessageBridge.deploy(
      hubBridge.address,
      [{ chainId: HUB_CHAIN_ID, messageFee: 1, maxBundleMessages: 2 }],
      SPOKE_CHAIN_ID
    )

    await hubBridge.setSpokeBridge(
      SPOKE_CHAIN_ID,
      spokeBridge.address,
      ONE_WEEK
    )

    console.log(`Hub Bridge: ${hubBridge.address}`)
    console.log(`Spoke Bridge: ${spokeBridge.address}`)

    const RESULT = 12345
    const toAddress = messageReceiver.address
    const message = MessageReceiver.interface.encodeFunctionData('setResult', [
      RESULT,
    ])
    const MESSAGE_VALUE = 5

    const messageId = getMessageId(
      sender.address,
      toAddress,
      MESSAGE_VALUE,
      message
    )

    const bundleRoot = solidityKeccak256(
      ['bytes32', 'bytes32'],
      [messageId, messageId]
    )

    const bundleId = solidityKeccak256(
      ['uint256', 'uint256', 'bytes32', 'uint256'],
      [SPOKE_CHAIN_ID, HUB_CHAIN_ID, bundleRoot, 12]
    )

    // Send message and commit bundle
    await spokeBridge
      .connect(sender)
      .sendMessage(HUB_CHAIN_ID, toAddress, message, MESSAGE_VALUE, {
        value: MESSAGE_VALUE + 1,
      })

    await spokeBridge
      .connect(sender)
      .sendMessage(HUB_CHAIN_ID, toAddress, message, MESSAGE_VALUE, {
        value: MESSAGE_VALUE + 1,
      })

    // Relay message
    await hubBridge.relayMessage(
      sender.address,
      toAddress,
      message,
      MESSAGE_VALUE,
      bundleId,
      0,
      [messageId],
      2
    )

    const res = await messageReceiver.result()
    const messageReceiverBal = await provider.getBalance(
      messageReceiver.address
    )
    expect(res).to.eq(RESULT)
    const msgValue = BigNumber.from(MESSAGE_VALUE)
    expect(messageReceiverBal).to.eq(msgValue)
  })
})

function getMessageId(
  from: string,
  to: string,
  value: BigNumberish,
  message: string
) {
  return keccak256(
    abi.encode(
      ['address', 'address', 'uint256', 'bytes'],
      [from, to, value, message]
    )
  )
}
