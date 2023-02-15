import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { hopMessengers } from './config'

async function main() {
  const chainId1 = '5'
  const chainId2 = '420'

  const signers = getSigners()
  const signer1 = signers[chainId1]
  const signer2 = signers[chainId2]

  const messengerAddress1 = hopMessengers[chainId1]
  const destinationMessengerAddress = hopMessengers[chainId2]

  // Deploy PingPong on both chains
  const connectorAddress = '0x0000000000000000000000000000000000000001' // This would be calculated first, deployed last
  const destinationPingPong = '0x0000000000000000000000000000000000000002' // This would be deployed before connector

  const PingPong = await ethers.getContractFactory('PingPong')
  const pingPong1 = await PingPong.connect(signer1).deploy(
    connectorAddress
  )
  await logContractDeployed('PingPong', pingPong1)

  const pingPong2 = await PingPong.connect(signer2).deploy(
    connectorAddress
  )
  await logContractDeployed('PingPong', pingPong2)

  const ERC5164ConnectorFactory = await ethers.getContractFactory(
    'ERC5164ConnectorFactory'
  )
  const ERC5164Connector = await ethers.getContractFactory('ERC5164Connector')

  const sourceConnectorFactory = await ERC5164ConnectorFactory.connect(
    signer1
  ).deploy(messengerAddress1)
  await logContractDeployed('ERC5164ConnectorFactory', sourceConnectorFactory)

  const tx: ContractTransaction = await sourceConnectorFactory.deployConnector(
    pingPong1.address,
    chainId2,
    connectorAddress,
    pingPong2.address
  )

  const receipt = await tx.wait()
  const event = receipt.events?.find(
    event => event.event === 'ConnectorDeployed'
  )
  const connectorAdrs = event?.args?.connector
  const connector = await ERC5164Connector.attach(connectorAdrs)

  const destinationConnectorFactory = await ERC5164ConnectorFactory.connect(
    signer2
  ).deploy(destinationMessengerAddress)

  await logContractDeployed(
    'ERC5164ConnectorFactory',
    destinationConnectorFactory
  )

  const calculatedAddress = await sourceConnectorFactory.calculateAddress(
    chainId1,
    pingPong1.address,
    chainId2,
    pingPong2.address
  )

  console.log('calculatedAddress', calculatedAddress)

  await logContractDeployed('ERC5164Connector', connector)

  // // Deploy on destination chain
  // const destinationMessengerAddress = hopMessengers[chainId2]

}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
