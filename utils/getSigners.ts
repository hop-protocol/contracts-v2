import * as ethers from 'ethers'

function getSigners() {
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!deployerPrivateKey) {
    throw new Error('Missing environment variable DEPLOYER_PRIVATE_KEY')
  }

  const hubRpc = process.env.RPC_ENDPOINT_GOERLI ?? ''
  const hubProvider = new ethers.providers.JsonRpcProvider(hubRpc)
  const hubSigner = new ethers.Wallet(deployerPrivateKey, hubProvider)

  const spokeRpc = process.env.RPC_ENDPOINT_OPTIMISM_GOERLI ?? ''
  const spokeProvider = new ethers.providers.JsonRpcProvider(spokeRpc)
  const spokeSigner = new ethers.Wallet(deployerPrivateKey, spokeProvider)

  return {
    hubSigner,
    spokeSigners: [spokeSigner],
    signers: {
      '5': hubSigner,
      '420': spokeSigner,
    } as { [key: string]: ethers.Wallet },
  }
}

export default getSigners
