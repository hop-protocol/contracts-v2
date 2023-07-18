import { Wallet } from 'ethers'
import getSigners from '@hop-protocol/shared/utils/getSigners'

async function main() {
  console.log('Normalizing nonces')
  const { signers: signerObject } = getSigners()

  const chains: string[] = []
  const signers: Wallet[] = []
  const nonces: number[] = []
  let highestNonce = 0
  for (const chainId in signerObject) {
    const signer = signerObject[chainId]
    const nonce = await signer.getTransactionCount()
    chains.push(chainId)
    signers.push(signer)
    nonces.push(nonce)
    if (nonce > highestNonce) {
      highestNonce = nonce
    }
    console.log(`Chain ${chainId} nonce: ${nonce}`)
  }

  for (let i = 0; i < chains.length; i++) {
    const nonceGap = highestNonce - nonces[i]
    console.log(`Chain ${chains[i]} nonce gap: ${nonceGap}`)
    const signer = signers[i]
    for (let j = 0; j < nonceGap; j++) {
      const tx = await signer.sendTransaction({to: signer.address})
      await tx.wait()
      process.stdout.write('.')
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
