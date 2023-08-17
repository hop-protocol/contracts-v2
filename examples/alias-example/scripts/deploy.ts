import { ethers } from 'hardhat'
import { ContractReceipt, Event } from 'ethers'
import { Interface, LogDescription } from 'ethers/lib/utils';
import getSigners from '@hop-protocol/shared-utils/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared-utils/utils/logContractDeployed'
import getAliasDeployment from '@hop-protocol/aliases/utils/getDeployment'

async function main() {
  const contracts: any = {}

  const hubChainId = '5'
  const spokeChainId = '420'

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { aliasDeployer: aliasDeployerAddress } = getAliasDeployment()

  const AliasDeployer = await ethers.getContractFactory('AliasDeployer')
  const aliasDeployer = await AliasDeployer.connect(hubSigner).attach(aliasDeployerAddress)

  console.log('Deploying governance...')
  const Governance = await ethers.getContractFactory('Governance')
  const governance = await Governance.connect(spokeSigner).deploy()
  contracts.governance = governance.address
  console.log('Deployed governance')

  const fee = await aliasDeployer.getFee([spokeChainId])
  const tx = await aliasDeployer.deployAliases(hubChainId, governance.address, [spokeChainId], { value: fee, gasLimit: 1500000 })
  const receipt = await tx.wait()

  const AliasFactory = await ethers.getContractFactory('AliasFactory')
  const AliasFactoryInterface = AliasFactory.interface

  const events = await parseEvents(receipt, AliasFactoryInterface)
  const aliasDispatcherAddress = events[0].args?.dispatcher
  console.log('aliasDispatcherAddress', aliasDispatcherAddress)

  // Deploy Greeters on both chains
  const Greeter = await ethers.getContractFactory('Greeter')
  const greeter = await Greeter.connect(spokeSigner).deploy(governance.address)
  await logContractDeployed('Greeter', greeter)

  console.log('Greeters deployed')
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function parseEvents(receipt: ContractReceipt, contractInterface: Interface, address?: string) {
  let logs: LogDescription[] = []
  receipt.events?.forEach(event => {
    if (address && event.address !== address) {
      return
    }
    try {
      const log = contractInterface.parseLog(event)
      logs.push(log)
    } catch (err) {
      return
    }
  })
  return logs
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
