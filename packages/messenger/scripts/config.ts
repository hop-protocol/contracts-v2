import { ethers } from 'hardhat'
const { parseUnits } = ethers.utils

export const txConfig = {
  gasLimit: 5_000_000,
}

export const deployConfig = {
  treasury: '0x1111000000000000000000000000000000001111',
  publicGoods: '0x2222000000000000000000000000000000002222',
  messageFee: '1000000000000',
  maxBundleMessages: 1,

  // Fee distribution
  fullPoolSize: parseUnits('0.1'),
  absoluteMaxFee: parseUnits('0.05'),
  absoluteMaxFeeBps: 3_000_000, // 300%
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
    bundleNonce:
      '0x67828efe977de865e3a6315b092ec6b10f5e0e149b7f3d43fbeaee953fa04f62',
    treeIndex: 0,
    siblings: [
      '0x07179261de5ae34af8281b9b73e5ed2aadb3ef14bad7e01a16cf8b643d51ea82',
    ],
    totalLeaves: 2,
  },
}
