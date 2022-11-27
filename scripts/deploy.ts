import * as ethers from 'ethers'
import { ethers as hhEthers } from "hardhat";
import * as dotenv from "dotenv";
const { parseUnits } = ethers.utils

export const ONE_WEEK = 604_800
export const TREASURY = '0x1111000000000000000000000000000000001111'
export const PUBLIC_GOODS = '0x2222000000000000000000000000000000002222'
export const ARBITRARY_EOA = '0x3333000000000000000000000000000000003333'
export const MIN_PUBLIC_GOODS_BPS = 100_000

// Fee distribution
export const FULL_POOL_SIZE = parseUnits('0.1')
export const MAX_BUNDLE_FEE = parseUnits('0.05')
export const MAX_BUNDLE_FEE_BPS = 3_000_000 // 300%

const config = {
  optimism: {
    l1CrossDomainMessenger: '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294',
    l2CrossDomainMessenger: '0x4200000000000000000000000000000000000007',
  },
}

async function main() {
  const HubMessageBridge = await hhEthers.getContractFactory("HubMessageBridge")
  const SpokeMessageBridge = await hhEthers.getContractFactory("SpokeMessageBridge")

  // HubMessageBridge.connect
  const { hubSigner, spokeSigners } = getSigners()
  const hubMessageBridge = await HubMessageBridge.connect(hubSigner).deploy()

  logContractDeployed('HubMessageBridge', hubMessageBridge)

  const spokeMessageBridges = []
  for (let i = 0; i < spokeSigners.length; i++) {
    const spokeSigner = spokeSigners[i]
    const hubChainId = await hubSigner.getChainId()
    const spokeChainId = await spokeSigner.getChainId()
    const spokeMessageBridge = await SpokeMessageBridge.connect(
      spokeSigner
    ).deploy(hubChainId, [
      {
        chainId: spokeChainId,
        messageFee: '1000000000000',
        maxBundleMessages: '16',
      },
    ])

    logContractDeployed('SpokeMessageBridge', spokeMessageBridge)

    const FeeDistributor = await hhEthers.getContractFactory(
      'ETHFeeDistributor'
    )

    const feeDistributor = await FeeDistributor.connect(hubSigner).deploy(
      hubMessageBridge.address,
      TREASURY,
      PUBLIC_GOODS,
      MIN_PUBLIC_GOODS_BPS,
      FULL_POOL_SIZE,
      MAX_BUNDLE_FEE,
      MAX_BUNDLE_FEE_BPS
    )

    await logContractDeployed('FeeDistributor', feeDistributor)

    spokeMessageBridges.push(spokeMessageBridge)

    const { l1Connector, l2Connector } = await deployConnectors(
      hubMessageBridge.address,
      spokeMessageBridge.address,
      hubSigner,
      spokeSigner
    )

    console.log('Connecting bridges...')
    await hubMessageBridge.setSpokeBridge(
      spokeChainId,
      l1Connector.address,
      ONE_WEEK,
      feeDistributor.address
    )

    await spokeMessageBridge.setHubBridge(
      hubMessageBridge.address,
      feeDistributor.address,
      { gasLimit: 5000000 }
    )
    console.log('Hub and Spoke bridge connected')
  }
}

async function logContractDeployed(name: string, contract: ethers.Contract) {
  await contract.deployed()

  const provider = contract.provider
  const networkName = (await provider.getNetwork()).name
  console.log(`${name} deployed on ${networkName}: ${contract.address}`)
}

async function deployConnectors(
  l1Target: string,
  l2Target: string,
  l1Signer: ethers.Signer,
  l2Signer: ethers.Signer
) {
  console.log('Deploying connectors...')
  const L1OptimismConnector = await hhEthers.getContractFactory(
    'L1OptimismConnector'
  )
  const L2OptimismConnector = await hhEthers.getContractFactory(
    'L2OptimismConnector'
  )

  const l1Connector = await L1OptimismConnector.connect(l1Signer).deploy(
    l1Target,
    config.optimism.l1CrossDomainMessenger,
    { gasLimit: 5000000 }
  )

  await logContractDeployed('L1Connector', l1Connector)

  const l2Connector = await L2OptimismConnector.connect(l2Signer).deploy(
    l2Target,
    config.optimism.l2CrossDomainMessenger,
    { gasLimit: 5000000 }
  )

  await logContractDeployed('L2Connector', l2Connector)

  console.log('Connecting L1Connector and L2Connector...')
  await l1Connector
    .connect(l1Signer)
    .setCounterpart(l2Connector.address, { gasLimit: 5000000 })
  await l2Connector
    .connect(l2Signer)
    .setCounterpart(l1Connector.address, { gasLimit: 5000000 })

  console.log('L1Connector and L2Connector connected')

  return {
    l1Connector,
    l2Connector,
  }
}

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
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
