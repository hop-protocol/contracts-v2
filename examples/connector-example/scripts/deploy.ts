import { ethers } from 'hardhat'
import getSigners from '@hop-protocol/shared-utils/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared-utils/utils/logContractDeployed'
import getConnectorDeployment from '@hop-protocol/connectors/utils/getDeployment'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { connectorFactories } = getConnectorDeployment()
  const hubConnectorFactoryAddress = connectorFactories[hubChainId]

  // Deploy factories
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )
  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).attach(hubConnectorFactoryAddress)

  // Deploy Greeters on both chains
  const Greeter = await ethers.getContractFactory('Greeter')
  const greeter1 = await Greeter.connect(hubSigner).deploy()
  await logContractDeployed('Greeter', greeter1)

  const greeter2 = await Greeter.connect(spokeSigner).deploy()
  await logContractDeployed('Greeter', greeter2)

  const tx = await hubConnectorFactory.deployConnectors(
    hubChainId,
    greeter1.address,
    spokeChainId,
    greeter2.address,
    { gasLimit: 1000000 }
  )

  const receipt = await tx.wait()
  const event = receipt.events?.find(
    event => event.event === 'ConnectorDeployed'
  )
  const connectorAddrs = event?.args?.connector

  const ERC5164Connector = await ethers.getContractFactory('ERC5164Connector')
  const hubConnector = await ERC5164Connector.connect(hubSigner).attach(
    connectorAddrs
  )
  await logContractDeployed('ERC5164Connector', hubConnector)

  console.log('Wait 2 minutes...')
  await wait(120_000)

  const spokeConnector = await ERC5164Connector.connect(spokeSigner).attach(
    connectorAddrs
  )
  await logContractDeployed('ERC5164Connector', spokeConnector)

  await greeter1.setConnector(connectorAddrs)
  await greeter2.setConnector(connectorAddrs)

  console.log('Greeters connected')
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
