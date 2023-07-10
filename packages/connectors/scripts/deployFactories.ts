import { Contract, Signer, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { getSigners, logContractDeployed } from '../utils'
import { dispatchers, executors } from './config'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const signers = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const hubDispatcherAddress = dispatchers[hubChainId]
  const spokeDispatcherAddress = dispatchers[spokeChainId]
  const hubExecutorAddress = executors[hubChainId]
  const spokeExecutorAddress = executors[spokeChainId]

  // Deploy factories
  const HubERC5164ConnectorFactory = await ethers.getContractFactory(
    'HubERC5164ConnectorFactory'
  )
  const hubConnectorFactory = await HubERC5164ConnectorFactory.connect(
    hubSigner
  ).deploy(hubDispatcherAddress, hubExecutorAddress)

  await logContractDeployed('HubERC5164ConnectorFactory', hubConnectorFactory)

  const ERC5164ConnectorFactory = await ethers.getContractFactory(
    'ERC5164ConnectorFactory'
  )
  const spokeConnectorFactory = await ERC5164ConnectorFactory.connect(
    spokeSigner
  ).deploy(spokeDispatcherAddress, spokeExecutorAddress)
  await logContractDeployed('ERC5164ConnectorFactory', spokeConnectorFactory)
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
