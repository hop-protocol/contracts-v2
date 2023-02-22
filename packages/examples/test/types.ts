import { BigNumber } from 'ethers'

export type TokenIdEncodingParams = {
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
