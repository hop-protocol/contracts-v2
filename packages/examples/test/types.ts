import { BigNumber } from 'ethers'

export type FixtureDefaults = {
  to: string
  tokenId: BigNumber
  tokenIndex: BigNumber
  chainId: BigNumber
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
