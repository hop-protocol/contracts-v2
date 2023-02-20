import { BigNumber, BigNumberish } from 'ethers'
import { TokenIdEncodingParams } from './types'
import { ethers } from 'hardhat'
const { getAddress, solidityPack, defaultAbiCoder: abi } = ethers.utils

export function generateTokenId(
  address: string,
  tokenIndex: BigNumberish
): BigNumber {
  const encodedTokenId = encodeTokenId(address, tokenIndex)
  return BigNumber.from(encodedTokenId)
}

export function encodeTokenId(
  address: string,
  tokenIndex: BigNumberish
): string {
  return solidityPack(['address', 'uint96'], [address, tokenIndex.toString()])
}

export function decodeTokenId(tokenId: BigNumberish): TokenIdEncodingParams {
  const tokenIdBn: BigNumber = BigNumber.from(tokenId)
  const encodedTokenId = abi.encode(['bytes32'], [tokenIdBn])

  const hexAddress = '0x' + encodedTokenId.substring(2, 42)
  const hexTokenIndex = '0x' + encodedTokenId.substring(42, 66)

  return {
    address: getAddress(hexAddress),
    tokenIndex: BigNumber.from(hexTokenIndex),
  }
}
