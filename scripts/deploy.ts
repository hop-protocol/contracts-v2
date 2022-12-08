import { Contract, Signer} from 'ethers'
import { ethers, tenderly } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
const { parseUnits } = ethers.utils
import { externalContracts, deployConfig } from './config'
import { ONE_WEEK } from './constants'

async function main() {
  const HubMessageBridge = await ethers.getContractFactory('HubMessageBridge')
  const SpokeMessageBridge = await ethers.getContractFactory(
    'SpokeMessageBridge'
  )

  const { hubSigner, spokeSigners } = getSigners()
  const hubName = (await hubSigner.provider.getNetwork()).name

  const hubMessageBridge = await HubMessageBridge.connect(hubSigner).deploy()

  await logContractDeployed('HubMessageBridge', hubMessageBridge)
  await tenderly.persistArtifacts({
    name: 'HubMessageBridge',
    address: hubMessageBridge.address,
    network: hubName,
  })

  const spokeMessageBridges = []
  for (let i = 0; i < spokeSigners.length; i++) {
    const spokeSigner = spokeSigners[i]
    const spokeName = (await spokeSigner.provider.getNetwork()).name
    const hubChainId = await hubSigner.getChainId()
    const spokeChainId = await spokeSigner.getChainId()
    const spokeMessageBridge = await SpokeMessageBridge.connect(
      spokeSigner
    ).deploy(hubChainId, [
      {
        chainId: hubChainId,
        messageFee: '1000000000000',
        maxBundleMessages: '8',
      },
    ])

    await logContractDeployed('SpokeMessageBridge', spokeMessageBridge)

    const FeeDistributor = await ethers.getContractFactory('ETHFeeDistributor')

    const feeDistributor = await FeeDistributor.connect(hubSigner).deploy(
      hubMessageBridge.address,
      deployConfig.treasury,
      deployConfig.publicGoods,
      deployConfig.minPublicGoodsBps,
      deployConfig.fullPoolSize,
      deployConfig.maxBundleFee,
      deployConfig.maxBundleFeeBps
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
      l2Connector.address,
      feeDistributor.address,
      { gasLimit: 5000000 }
    )
    console.log('Hub and Spoke bridge connected')
  }
}

async function deployConnectors(
  l1Target: string,
  l2Target: string,
  l1Signer: Signer,
  l2Signer: Signer
) {
  console.log('Deploying connectors...')
  const L1OptimismConnector = await ethers.getContractFactory(
    'L1OptimismConnector'
  )
  const L2OptimismConnector = await ethers.getContractFactory(
    'L2OptimismConnector'
  )

  const l1Connector = await L1OptimismConnector.connect(l1Signer).deploy(
    l1Target,
    externalContracts.optimism.l1CrossDomainMessenger,
    { gasLimit: 5000000 }
  )

  await logContractDeployed('L1Connector', l1Connector)

  const l2Connector = await L2OptimismConnector.connect(l2Signer).deploy(
    l2Target,
    externalContracts.optimism.l2CrossDomainMessenger,
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
