import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer, providers } from 'ethers'
import { DecodedTokenIdParams } from './types'
import { ethers } from 'hardhat'
const { getAddress, solidityPack, defaultAbiCoder: abi } = ethers.utils

// This attempts to mimic the expect interface. There are a few things to note here:
// 1. await can be used when calling this function, but it technically is not used
// 2. The tx needs to be populated (with await and populateTransaction) before calling this function
export function expectCall(
  tx: providers.TransactionRequest,
  sender: Signer
): Chai.Assertion {
  return expect(sender.sendTransaction(tx))
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

export function decodeTokenId(tokenId: BigNumberish): DecodedTokenIdParams {
  const tokenIdBn: BigNumber = BigNumber.from(tokenId)
  const bytes32EncodedTokenId = abi.encode(['bytes32'], [tokenIdBn])

  const hexAddress = '0x' + bytes32EncodedTokenId.substring(2, 42)
  const hexTokenIndex = '0x' + bytes32EncodedTokenId.substring(42, 66)

  return {
    address: getAddress(hexAddress),
    tokenIndex: BigNumber.from(hexTokenIndex),
  }
}
