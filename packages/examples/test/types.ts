import { BigNumber } from 'ethers'

export type TokenIdEncodingParams = {
  address: string
  tokenIndex: BigNumber
}

export enum TokenState {
  Unminted,
  Minted,
  Sent,
}

export type TokenStatuses = {
  confirmed: boolean
  tokenState: TokenState
  toChainId: BigNumber
}
