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
      '5': '0xE3F4c0B210E7008ff5DE92ead0c5F6A5311C4FDC',
      '420': '0xeA35E10f763ef2FD5634dF9Ce9ad00434813bddB',
    } as { [keyof: string]: string },
    auxiliary: {
      '420': {
        l1Connector: '0xB0e2f9d9F2fDD23A34A519A6C8Aa12D95181EC4b',
        l2Connector: '0x6be2E6Ce67dDBCda1BcdDE7D2bdCC50d34A7eD24',
        feeDistributor: '0xf6eED903Ac2A34E115547874761908DD3C5fe4bf',
      },
    } as { [keyof: string]: AuxiliaryAddresses },
  },
}
