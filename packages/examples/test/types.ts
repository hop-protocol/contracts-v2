import { BigNumber, Signer } from 'ethers'

export type FixtureDefaults = {
  signer: Signer
  chainId: BigNumber
  toChainId: BigNumber
  to: string
  tokenId: BigNumber
  tokenIndex: BigNumber
  autoExecute: boolean
}

export type DecodedTokenIdParams = {
  address: string
  tokenIndex: BigNumber
}

// TODO: Get this from the contract ABI
export type TokenForwardData = {
  toChainId: BigNumber
  tokenId: BigNumber
}

// TODO: Get this from the contract ABI
export type TokenStatuses = {
  confirmed: boolean
  tokenForwardCount: BigNumber
  tokenForwardDatas: TokenForwardData[]
}
