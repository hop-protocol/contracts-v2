import { BigNumberish, ContractFactory } from 'ethers'

async function getSetResultCalldata(result: BigNumberish): Promise<string> {
  const setResultInterface = ContractFactory.getInterface(['function setResult(uint256)'])
  const message = setResultInterface.encodeFunctionData('setResult', [result])
  return message
}

export default getSetResultCalldata
