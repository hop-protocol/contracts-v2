import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
const { keccak256, solidityPack } = ethers.utils

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

export function getTokenId(
  chainId: BigNumber,
  minter: string,
  serialNumber: BigNumber,
  previousTokenId: BigNumber
): BigNumber {
  const tokenIdHash = keccak256(
    solidityPack(
      ['uint256', 'address', 'uint256', 'uint256'],
      [chainId, minter, serialNumber, previousTokenId]
    )
  )
  return BigNumber.from(tokenIdHash)
}
