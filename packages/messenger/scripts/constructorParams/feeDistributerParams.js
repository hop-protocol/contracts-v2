const { contracts, deployConfig } = require('../config')
const { messengers } = contracts.testnet

const {
  treasury,
  publicGoods,
  minPublicGoodsBps,
  fullPoolSize,
  maxBundleFee,
  maxBundleFeeBps,
} = deployConfig

const hubMessageBridgeAddress = messengers['5']

module.exports = [
  hubMessageBridgeAddress,
  treasury,
  publicGoods,
  minPublicGoodsBps,
  fullPoolSize,
  maxBundleFee,
  maxBundleFeeBps,
]
