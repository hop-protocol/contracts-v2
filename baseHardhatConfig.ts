import path from 'path'
import * as dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'solidity-coverage'

dotenv.config({
  path: path.join(__dirname, '.env'),
})

const accounts =
  process.env.DEPLOYER_PRIVATE_KEY !== undefined
    ? [process.env.DEPLOYER_PRIVATE_KEY]
    : []

const config: HardhatUserConfig = {
  solidity: {
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
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      // arbitrum: process.env.ARBITRUM_API_KEY || '',
      // gnosis: process.env.GNOSIS_API_KEY || '',
      goerli: process.env.ETHERSCAN_API_KEY || '',
      optimisticGoerli: process.env.OPTIMISM_API_KEY || '',
    },
  },
}

export default config
