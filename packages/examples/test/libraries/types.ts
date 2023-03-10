import { BigNumber, Signer } from 'ethers'

export type FixtureDefaults = {
  signer: Signer
  chainId: BigNumber
  tokenId: BigNumber
  toChainId: BigNumber
  to: string
  serialNumber: BigNumber
  previousTokenId: BigNumber
  owner: string
  autoExecute: boolean
}

// TODO: Get this from the contract ABI
export type TokenData = {
  serialNumber: BigNumber
  toChainId: BigNumber
  to: string
  confirmed: boolean
  spent: boolean
}
