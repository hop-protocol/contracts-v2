import { BigNumber, Signer } from 'ethers'

export type FixtureDefaults = {
  signer: Signer
  chainId: BigNumber
  toChainId: BigNumber
  to: string
  tokenId: BigNumber
  previousTokenId: BigNumber
  serialNumber: BigNumber
  autoExecute: boolean
}

// TODO: Get this from the contract ABI
export type TokenData = {
  serialNumber: BigNumber
  toChainId: BigNumber
  confirmed: boolean
  spent: boolean
}
