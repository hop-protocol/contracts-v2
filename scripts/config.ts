import { ethers } from 'hardhat'
const { parseUnits } = ethers.utils

export const externalContracts = {
  optimism: {
    l1CrossDomainMessenger: '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294',
    l2CrossDomainMessenger: '0x4200000000000000000000000000000000000007',
  },
}

export const coreMessengerAddresses: { [keyof: string]: string } = {
  '5': '0x9827315F7D2B1AAd0aa4705c06dafEE6cAEBF920',
  '420': '0x4b844c25EF430e71D42EEA89d87Ffe929f8db927',
}

type SpokePeripheryAddresses = {
  // spokeMessageBridge: string
  // l1Connector: string
  // l2Connector: string
  // feeDistributor: string
}

export const spokePeripheryAddresses: {
  [keyof: string]: SpokePeripheryAddresses
} = {
  '420': {
    // spokeMessageBridge: '0x4c67906e1cdA0a785552e130F8F91B655d0a302D',
    // l1Connector: '0xF4fdE68275C74C9D879B4a20bf1CD45dd6EB8F0b',
    // l2Connector: '0x19480Da508241e0f91e5D13036E62278C7e73B79',
    // feeDistributor: '0xf82326D7A8aEFf8Cb8129B9284E71859eB29EaE8',
  },
}

// HubMessageBridge deployed on goerli: 0x9827315F7D2B1AAd0aa4705c06dafEE6cAEBF920
// SpokeMessageBridge deployed on optimism-goerli: 0x4b844c25EF430e71D42EEA89d87Ffe929f8db927
// FeeDistributor deployed on goerli: 0x8fF09Ff3C87085Fe4607F2eE7514579FE50944C5
// Deploying connectors...
// L1Connector deployed on goerli: 0x4b844c25EF430e71D42EEA89d87Ffe929f8db927
// L2Connector deployed on optimism-goerli: 0x342EA1227fC0e085704D30cd17a16cA98B58D08B

export const ONE_WEEK = 604_800
export const TREASURY = '0x1111000000000000000000000000000000001111'
export const PUBLIC_GOODS = '0x2222000000000000000000000000000000002222'
export const ARBITRARY_EOA = '0x3333000000000000000000000000000000003333'
export const MIN_PUBLIC_GOODS_BPS = 100_000

// Fee distribution
export const FULL_POOL_SIZE = parseUnits('0.1')
export const MAX_BUNDLE_FEE = parseUnits('0.05')
export const MAX_BUNDLE_FEE_BPS = 3_000_000 // 300%
