import { ethers } from 'hardhat'
import getSigners from '@hop-protocol/shared-utils/utils/getSigners'
import logContractDeployed from '@hop-protocol/shared-utils/utils/logContractDeployed'
import getAliasDeployment from '@hop-protocol/aliases/utils/getDeployment'

async function main() {
  const hubChainId = '5'
  const spokeChainId = '420'

  const { signers } = getSigners()
  const hubSigner = signers[hubChainId]
  const spokeSigner = signers[spokeChainId]

  const { aliasDeployer: aliasDeployerAddress } = getAliasDeployment()

  const AliasDeployer = await ethers.getContractFactory('AliasDeployer')
  const aliasDeployer = await AliasDeployer.connect(hubSigner).attach(aliasDeployerAddress)

  const Governance = await ethers.getContractFactory('Governance')
  const governance = await Governance.connect(spokeSigner).deploy()

  const tx = await aliasDeployer.deployAliases(hubChainId, governance.address, [spokeChainId])
  await tx.wait()

  // Deploy Greeters on both chains
  const Greeter = await ethers.getContractFactory('Greeter')
  const greeter = await Greeter.connect(spokeSigner).deploy(governance.address)
  await logContractDeployed('Greeter', greeter)


  console.log('Greeters deployed')
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
