import { parseUnits } from 'ethers/lib/utils'

export const EXIT_TIME = 60 // 1 min for testnet
export const RELAY_WINDOW = 3600 // 1 hour for testnet
export const ABSOLUTE_MAX_FEE = parseUnits('1', 'ether')
export const MAX_FEE_BPS = 30_000 // 3x
export const ARBITRARY_EOA = '0x3333000000000000000000000000000000003333'
