import { expect, use } from 'chai'
import { providers, ContractTransaction, BigNumber, BigNumberish, Signer, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
import {
  ONE_WEEK,
  DEFAULT_RESULT,
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

export function getMessageId(
  nonce: BigNumberish,
  fromChainId: BigNumberish,
  from: string,
  toChainId: BigNumberish,
  to: string,
  message: BytesLike
) {
  return keccak256(
    abi.encode(
      ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes'],
      [nonce, fromChainId, from, toChainId, to, message]
    )
  )
}

export async function getSetResultCalldata(result: BigNumberish): Promise<string> {
  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')
  const message = MessageReceiver.interface.encodeFunctionData('setResult', [
    result,
  ])
  return message
}

export function getBundleRoot(messageIds: string[]) {
  // ToDo: Get actual root
  const bundleRoot = solidityKeccak256(
    ['bytes32', 'bytes32'],
    [messageIds[0], messageIds[1]]
  )

  return bundleRoot
}
