import * as dotenv from 'dotenv'
import { HardhatUserConfig, task } from 'hardhat/config'
// import '@tenderly/hardhat-tenderly'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import './tasks/exitBundle'

dotenv.config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const accounts =
  process.env.DEPLOYER_PRIVATE_KEY !== undefined
    ? [process.env.DEPLOYER_PRIVATE_KEY]
    : []

const config: HardhatUserConfig = {
  solidity:{
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500000,
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500000,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.HOP_MNEMONIC_TESTNET,
      },
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: {
        mnemonic: process.env.HOP_MNEMONIC_TESTNET,
      },
    },
    goerli: {
      url: process.env.RPC_ENDPOINT_GOERLI || '',
      accounts,
    },
    optimismGoerli: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_GOERLI || '',
      accounts,
    },
    mainnet: {
      url: process.env.RPC_ENDPOINT_MAINNET || '',
      accounts,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      // arbitrum: process.env.ARBITRUM_API_KEY || '',
      // gnosis: process.env.GNOSIS_API_KEY || '',
      goerli: process.env.ETHERSCAN_API_KEY || '',
      optimisticGoerli: process.env.OPTIMISM_API_KEY || '',
    },
  },
  // tenderly: {
  //   project: process.env.TENDERLY_PROJECT || '',
  //   username: process.env.TENDERLY_USERNAME || '',
  // },
}

export default config
