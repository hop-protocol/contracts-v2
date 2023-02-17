import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { connectorFactories } from './config'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  // Deploy factories
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )
  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).attach(connectorFactories[hubChainId])
  await logContractDeployed('HubERC5164ConnectorFactory', hubConnectorFactory)

  const ERC5164ConnectorFactory = await ethers.getContractFactory(
    'ERC5164ConnectorFactory'
  )
  const spokeConnectorFactory = await ERC5164ConnectorFactory.connect(
    spokeSigner
  ).attach(connectorFactories[spokeChainId])
  await logContractDeployed('ERC5164ConnectorFactory', spokeConnectorFactory)

  // Deploy PingPong on both chains
  const PingPong = await ethers.getContractFactory('PingPong')
  const pingPong1 = await PingPong.connect(hubSigner).deploy()
  await logContractDeployed('PingPong', pingPong1)

  const pingPong2 = await PingPong.connect(spokeSigner).deploy()
  await logContractDeployed('PingPong', pingPong2)

  const tx = await hubConnectorFactory.connectTargets(
    hubChainId,
    pingPong1.address,
    spokeChainId,
    pingPong2.address
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

  console.log('Wait 1  minute...')
  await wait(60_000)

  const spokeConnector = await ERC5164Connector.connect(spokeSigner).attach(
    connectorAddrs
  )
  await logContractDeployed('ERC5164Connector', spokeConnector)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
