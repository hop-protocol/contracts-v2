import { ethers } from 'hardhat'
const { parseUnits } = ethers.utils

export const txConfig = {
  gasLimit: 5_000_000,
}

export const deployConfig = {
  treasury: '0x1111000000000000000000000000000000001111',
  publicGoods: '0x2222000000000000000000000000000000002222',
  messageFee: '1000000000000',
  maxBundleMessages: 8,

  // Fee distribution
  fullPoolSize: parseUnits('0.1'),
  maxBundleFee: parseUnits('0.05'),
  maxBundleFeeBps: 3_000_000, // 300%
  minPublicGoodsBps: 100_000,
}

export const messageConfig = {
  message: {
    fromChainId: 420,
    toChainId: 5,
    to: '0x7B258c793CdbC3567B6727a2Ad8Bc7646d74c55C',
    result: 999,
  },
  proof: {
    bundleId:
      '0x67828efe977de865e3a6315b092ec6b10f5e0e149b7f3d43fbeaee953fa04f62',
    treeIndex: 0,
    siblings: [
      '0x07179261de5ae34af8281b9b73e5ed2aadb3ef14bad7e01a16cf8b643d51ea82',
    ],
    totalLeaves: 2,
  },
}

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
