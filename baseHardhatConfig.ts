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
        mnemonic: process.env.HOP_MNEMONIC_TESTNET || '',
      },
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: {
        mnemonic: process.env.HOP_MNEMONIC_TESTNET || '',
      },
    },
    mainnet: {
      url: process.env.RPC_ENDPOINT_MAINNET || '',
      accounts
    },
    goerli: {
      url: process.env.RPC_ENDPOINT_GOERLI || '',
      accounts
    },
    arbitrum_mainnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_MAINNET || '',
      accounts
    },
    nova_mainnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_NOVA || '',
      accounts
    },
    arbitrum_testnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_TESTNET || '',
      accounts
    },
    optimism_mainnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_MAINNET || '',
      accounts
    },
    optimism_testnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_TESTNET || '',
      accounts
    },
    xdai: {
      url: process.env.RPC_ENDPOINT_XDAI || '',
      accounts,
    },
    polygon: {
      url: process.env.RPC_ENDPOINT_POLYGON || '',
      accounts,
    },
    mumbai: {
      url: process.env.RPC_ENDPOINT_MUMBAI || '',
      accounts
    },
    consensys_testnet: {
      url: process.env.RPC_ENDPOINT_CONSENSYS_TESTNET || '',
      accounts
    },
    base_testnet: {
      url: process.env.RPC_ENDPOINT_BASE_TESTNET || '',
      accounts
    },
    scroll_testnet: {
      url: process.env.RPC_ENDPOINT_SCROLL_TESTNET || '',
      accounts
    },
    polygonzk_mainnet: {
      url: process.env.RPC_ENDPOINT_POLYGONZK_MAINNET || '',
      accounts
    },
    polygonzk_testnet: {
      url: process.env.RPC_ENDPOINT_POLYGONZK_TESTNET || '',
      accounts
    },
    base_mainnet: {
      url: process.env.RPC_ENDPOINT_BASE_MAINNET || '',
      accounts
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      goerli: process.env.ETHERSCAN_API_KEY || '',
      arbitrumOne: process.env.ARBITRUM_API_KEY || '',
      optimisticEthereum: process.env.OPTIMISM_API_KEY || '',
      xdai: process.env.XDAI_API_KEY || '',
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || '',
      nova_mainnet: process.env.NOVA_API_KEY || '',
      consensys_testnet: process.env.CONSENSYS_API_KEY || '',
      zksync_testnet: process.env.ZKSYNC_API_KEY || '',
      base_testnet: process.env.BASE_API_KEY || '',
      scroll_testnet: process.env.SCROLL_API_KEY || '',
      polygonzk_mainnet: process.env.POLYGONZK_API_KEY || '',
      polygonzk_testnet: process.env.POLYGONZK_API_KEY || '',
      base_mainnet: process.env.BASE_API_KEY || '',
    },
    customChains: [
      {
        network: 'xdai',
        chainId: 100,
        urls: {
          apiURL: 'https://api.gnosisscan.io/api',
          browserURL: 'https://gnosisscan.io'
        }
      },
      {
        network: 'optimism_testnet',
        chainId: 420,
        urls: {
          apiURL: 'https://api-goerli-optimism.etherscan.io/api',
          browserURL: 'https://goerli-optimism.etherscan.io'
        }
      },
      {
        network: 'nova_mainnet',
        chainId: 42170,
        urls: {
          apiURL: 'https://api-nova.arbiscan.io/api',
          browserURL: 'https://nova.arbiscan.io'
        }
      },
      {
        network: 'consensys_testnet',
        chainId: 59140,
        urls: {
          apiURL: 'https://explorer.goerli.zkevm.consensys.net/api',
          browserURL: 'https://explorer.goerli.zkevm.consensys.net'
        }
      },
      {
        network: 'zksync_testnet',
        chainId: 280,
        urls: {
          apiURL: 'https://goerli.explorer.zksync.io/api',
          browserURL: 'https://goerli.explorer.zksync.io/'
        }
      },
      {
        network: 'base_testnet',
        chainId: 84531,
        urls: {
          apiURL: 'https://api-goerli.basescan.org/api',
          browserURL: 'https://goerli.basescan.org'
        }
      },
      {
        network: 'scroll_testnet',
        chainId: 534353,
        urls: {
          apiURL: 'https://blockscout.scroll.io/api',
          browserURL: 'https://blockscout.scroll.io'
        }
      },
      {
        network: 'polygonzk_mainnet',
        chainId: 1101,
        urls: {
          apiURL: 'https://api-zkevm.polygonscan.com/api',
          browserURL: 'https://zkevm.polygonscan.com/'
        }
      },
      {
        network: 'polygonzk_testnet',
        chainId: 1442,
        urls: {
          apiURL: 'https://api-testnet-zkevm.polygonscan.com/api',
          browserURL: 'https://testnet-zkevm.polygonscan.com/'
        }
      },
      {
        network: 'base_mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org'
        }
      },
    ]
  },
}

export default config
