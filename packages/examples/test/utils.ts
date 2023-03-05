import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { DecodedTokenIdParams } from './types'
import { ethers } from 'hardhat'
const { getAddress, solidityPack, defaultAbiCoder: abi } = ethers.utils

export async function expectCallRevert(
  tx: any,
  errorSignature: string,
  errorArgs: any[] = []
) {
  try {
    await tx
  } catch (err: any) {
    expect(errorSignature).to.eq(err.errorSignature)
    for (const [index, errorArg] of errorArgs.entries()) {
      expect(errorArg).to.eq(err.errorArgs[index])
    }
  }
}

export function encodeTokenId(address: string, tokenId: BigNumber): BigNumber {
  const { tokenIndex } = decodeTokenId(tokenId)
  return encodeTokenIndex(address, tokenIndex)
}

export function encodeTokenIndex(
  address: string,
  tokenIndex: BigNumber
): BigNumber {
  const encodedTokenIndex = solidityPack(
    ['address', 'uint96'],
    [address, tokenIndex.toString()]
  )
  return BigNumber.from(encodedTokenIndex)
}

export function decodeTokenId(tokenId: BigNumber): DecodedTokenIdParams {
  const tokenIdBn: BigNumber = BigNumber.from(tokenId)
  const bytes32EncodedTokenId = abi.encode(['bytes32'], [tokenIdBn])

  const hexAddress = '0x' + bytes32EncodedTokenId.substring(2, 42)
  const hexTokenIndex = '0x' + bytes32EncodedTokenId.substring(42, 66)

  return {
    address: getAddress(hexAddress),
    tokenIndex: BigNumber.from(hexTokenIndex),
  }
}
