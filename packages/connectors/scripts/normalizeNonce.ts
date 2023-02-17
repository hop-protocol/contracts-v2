import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { hopMessengers } from './config'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  await spokeSigner.sendTransaction({to: spokeSigner.address})
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
