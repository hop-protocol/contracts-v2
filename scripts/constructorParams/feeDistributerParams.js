const {
  coreMessengerAddresses,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
  MAX_BUNDLE_FEE,
  MAX_BUNDLE_FEE_BPS,
} = require('../config')

const hubMessageBridgeAddress = coreMessengerAddresses['5']

module.exports = [
  hubMessageBridgeAddress,
  TREASURY,
  PUBLIC_GOODS,
  MIN_PUBLIC_GOODS_BPS,
  FULL_POOL_SIZE,
  MAX_BUNDLE_FEE,
  MAX_BUNDLE_FEE_BPS,
]
