import { BigNumberish } from 'ethers'
import { ethers } from 'hardhat'

export async function getSetResultCalldata(
  result: BigNumberish
): Promise<string> {
  const MessageReceiver = await ethers.getContractFactory('MockMessageReceiver')
  const message = MessageReceiver.interface.encodeFunctionData('setResult', [
    result,
  ])
  return message
}
