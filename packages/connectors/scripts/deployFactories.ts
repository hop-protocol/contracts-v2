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

  const hubMessengerAddress = hopMessengers[hubChainId]
  const spokeMessengerAddress = hopMessengers[spokeChainId]

  // Deploy factories
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )
  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).deploy(hubMessengerAddress)

  await logContractDeployed('HubERC5164ConnectorFactory', hubConnectorFactory)

  const ERC5164ConnectorFactory = await ethers.getContractFactory(
    'ERC5164ConnectorFactory'
  )
  const spokeConnectorFactory = await ERC5164ConnectorFactory.connect(
    spokeSigner
  ).deploy(spokeMessengerAddress)
  await logContractDeployed('ERC5164ConnectorFactory', spokeConnectorFactory)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
