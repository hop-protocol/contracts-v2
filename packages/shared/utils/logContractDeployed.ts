import { Contract} from 'ethers'

async function logContractDeployed(name: string, contract: Contract) {
  await contract.deployed()

  const provider = contract.provider
  const networkName = (await provider.getNetwork()).name
  console.log(`${name} deployed on ${networkName}: ${contract.address}`)
}

export default logContractDeployed
