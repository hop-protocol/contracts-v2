import { expect, use } from 'chai'
import { ethers } from 'hardhat'
// import { SpokeMessageBridge } from 'typechain'
import type { SpokeMessageBridge as ISpokeMessageBridge } from '../typechain'

type BigNumberish = typeof ethers.BigNumber | string | number
const { BigNumber, provider } = ethers
const { solidityKeccak256, keccak256, defaultAbiCoder: abi } = ethers.utils

const ONE_WEEK = 604800
const HUB_CHAIN_ID = 1111
const SPOKE_CHAIN_ID = 1112
const RESULT = 12345
const MESSAGE_VALUE = 5
const MESSAGE_FEE = 1
const MAX_BUNDLE_MESSAGES = 2

describe('contracts', function () {
  it('Should call contract Spoke to Hub', async function () {
    const [deployer, sender, relayer] = await ethers.getSigners()
    const message = await getSetResultCalldata(RESULT)

    const { hubBridge, spokeBridges, messageReceiver } = await fixture(
      HUB_CHAIN_ID,
      [SPOKE_CHAIN_ID]
    )
    const spokeBridge = spokeBridges[0]

    console.log(`Hub Bridge: ${hubBridge.address}`)
    console.log(`Spoke Bridge: ${spokeBridge.address}`)
    console.log(`Message Receiver: ${messageReceiver.address}`)

    const toAddress = messageReceiver.address

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

    // ToDo: Get messageId, bundleId from events
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

async function fixture(hubChainId: number, spokeChainIds: number[]) {
  const HubMessageBridge = await ethers.getContractFactory(
    'MockHubMessageBridge'
  )
  const SpokeMessageBridge = await ethers.getContractFactory(
    'MockSpokeMessageBridge'
  )
  const MessageReceiver = await ethers.getContractFactory('MessageReceiver')
  const hubBridge = await HubMessageBridge.deploy(hubChainId)
  const spokeBridges: ISpokeMessageBridge[] = []
  for (let i = 0; i < spokeChainIds.length; i++) {
    const spokeChainId = spokeChainIds[i]
    const spokeBridge = await SpokeMessageBridge.deploy(
      hubBridge.address,
      [
        {
          chainId: hubChainId,
          messageFee: MESSAGE_FEE,
          maxBundleMessages: MAX_BUNDLE_MESSAGES,
        },
      ],
      SPOKE_CHAIN_ID
    )
    await hubBridge.setSpokeBridge(spokeChainId, spokeBridge.address, ONE_WEEK)

    spokeBridges.push(spokeBridge)
  }

  const messageReceiver = await MessageReceiver.deploy()

  return { hubBridge, spokeBridges, messageReceiver }
}

async function getSetResultCalldata(result: BigNumberish): Promise<string> {
  const MessageReceiver = await ethers.getContractFactory('MessageReceiver')
  const message = MessageReceiver.interface.encodeFunctionData('setResult', [
    RESULT,
  ])
  return message
}
