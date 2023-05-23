import { BigNumber, utils } from 'ethers'
import { getSetResultCalldata } from './utils'
const { parseUnits } = utils

export const ONE_WEEK = 604800

export const HUB_CHAIN_ID = BigNumber.from(1000)
export const SPOKE_CHAIN_ID_0 = BigNumber.from(2000)
export const SPOKE_CHAIN_ID_1 = BigNumber.from(2001)
export const TREASURY = '0x1111000000000000000000000000000000001111'
export const PUBLIC_GOODS = '0x2222000000000000000000000000000000002222'
export const ARBITRARY_EOA = '0x3333000000000000000000000000000000003333'
export const MIN_PUBLIC_GOODS_BPS = 100_000

// Fee distribution
export const FULL_POOL_SIZE = parseUnits('0.1')
export const MAX_BUNDLE_FEE = parseUnits('0.05')
export const MAX_BUNDLE_FEE_BPS = 3_000_000 // 300%

// Fee collection
export const MAX_BUNDLE_MESSAGES = 32
export const MESSAGE_FEE = parseUnits('0.000007')
export const TRANSPORT_FEE = parseUnits('0.007')
export const RELAY_WINDOW = 12 * 3600 // 12 hours

// Message
export const DEFAULT_RESULT = 1234
export const DEFAULT_COMMITMENT = '0x1234500000000000000000000000000000000000000000000000000000012345'
export const DEFAULT_FROM_CHAIN_ID = SPOKE_CHAIN_ID_0
export const DEFAULT_TO_CHAIN_ID = HUB_CHAIN_ID
export const DEFAULT_DATA = getSetResultCalldata(DEFAULT_RESULT)
