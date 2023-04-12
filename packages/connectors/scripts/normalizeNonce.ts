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

  for (let i = 0; i < 15; i++) {
    const tx = await spokeSigner.sendTransaction({to: spokeSigner.address})
    await tx.wait()
  }

  for (let i = 0; i < 0; i++) {
    const tx = await hubSigner.sendTransaction({to: hubSigner.address})
    await tx.wait()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
