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

type AuxiliaryAddresses = {
  // l1Connector: string
  // l2Connector: string
  // feeDistributor: string
}

export const contracts = {
  testnet: {
    externalContracts: {
      optimism: {
        l1CrossDomainMessenger: '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294',
        l2CrossDomainMessenger: '0x4200000000000000000000000000000000000007',
      },
    },
    messengers: {
      '5': '0x9827315F7D2B1AAd0aa4705c06dafEE6cAEBF920',
      '420': '0x4b844c25EF430e71D42EEA89d87Ffe929f8db927',
    } as { [keyof: string]: string },
    auxiliary: {
      '420': {
        // l1Connector: '0xF4fdE68275C74C9D879B4a20bf1CD45dd6EB8F0b',
        // l2Connector: '0x19480Da508241e0f91e5D13036E62278C7e73B79',
        // feeDistributor: '0xf82326D7A8aEFf8Cb8129B9284E71859eB29EaE8',
      },
    } as { [keyof: string]: AuxiliaryAddresses },
  },
}
