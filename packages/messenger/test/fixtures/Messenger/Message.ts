import { BigNumber, BigNumberish, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
const { keccak256, defaultAbiCoder: abi } = ethers.utils

class SpokeMessage {
  bundleId: string
  treeIndex: BigNumber
  fromChainId: BigNumber
  from: string
  toChainId: BigNumber
  to: string
  data: BytesLike

  constructor(
    _bundleId: string,
    _treeIndex: BigNumberish,
    _fromChainId: BigNumberish,
    _from: string,
    _toChainId: BigNumberish,
    _to: string,
    _data: BytesLike
  ) {
    this.bundleId = _bundleId
    this.treeIndex = BigNumber.from(_treeIndex)
    this.fromChainId = BigNumber.from(_fromChainId)
    this.from = _from
    this.toChainId = BigNumber.from(_toChainId)
    this.to = _to
    this.data = _data
  }

  getMessageId() {
    return keccak256(
      abi.encode(
        [
          'bytes32',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'address',
          'bytes',
        ],
        [
          this.bundleId,
          this.treeIndex,
          this.fromChainId,
          this.from,
          this.toChainId,
          this.to,
          this.data,
        ]
      )
    )
  }
}

export default SpokeMessage
