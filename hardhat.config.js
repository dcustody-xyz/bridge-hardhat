const { HardhatUserConfig, extendEnvironment } = require("hardhat/config");
const { createProvider } = require("hardhat/internal/core/providers/construction");
const fs = require('fs')

require('@nomicfoundation/hardhat-chai-matchers')
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");

extendEnvironment(async (hre) => {
  hre.changeNetwork = async function changeNetwork(newNetwork) {
    hre.network.name = newNetwork;
    hre.network.config = hre.config.networks[newNetwork];
    hre.ethers.provider = new hre.ethers.JsonRpcProvider(hre.network.config.url);
    hre.network.provider = await createProvider(hre.config, newNetwork);
  }
})

const accounts = (fork) => {
  if (!fork && process.env.PRIVATE_KEY)
    return [{privateKey: process.env.PRIVATE_KEY, balance: 10e18.toString()}]
  else
    return []
}

const hardhatNetwork = () => {
  switch (+process.env.HARDHAT_INTEGRATION_CHAIN) {
    case 1:
      return {
        network_id:    1,
        chainId:       1,
        gasMultiplier: 5,
        forking:       {
          url:           `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
          gasMultiplier: 5,
          blockNumber:   14980909
        }
      }
    case 10:
      return {
        network_id:    10,
        chainId:       10,
        gasMultiplier: 5,
        forking:       {
          url:           `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_OPTIMISM_API_KEY}`,
          gasMultiplier: 5,
          blockNumber:   (+process.env.BLOCK || 22562704)
        }
      }
    case 56:
      return {
        network_id:    56,
        chainId:       56,
        gasMultiplier: 5,
        forking:       {
          url:           `https://speedy-nodes-nyc.moralis.io/${process.env.MORALIS_API_KEY}/bsc/mainnet/archive`,
          gasMultiplier: 5,
          blockNumber:   14051137
        }
      }
    case 137:
      return {
        chains: {
          137: {
            hardforkHistory: {
              london: 23850000
            }
          }
        },
        network_id:    137,
        chainId:       137,
        gasMultiplier: 10,
        forking:       {
          url:           `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          gasMultiplier: 10,
          blockNumber:   (+process.env.BLOCK || 19880876)
          // blockNumber:   28401104
          // blockNumber:    24479611 // test for balancer
        }
      }
    case 80001:
      return {
        network_id:    80001,
        chainId:       80001,
        gasMultiplier: 5,
        forking:       {
          url:           `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_MUMBAI_KEY}`,
          gasMultiplier: 5,
          blockNumber:   20761905
        }
      }
    case 11155111: // Sepolia
      return {
        network_id:    11155111,
        chainId:       11155111,
        accounts: accounts(true),
        forking: {
          url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_SEPOLIA_API_KEY}`,
          blockNumber: 4503700,
        }
      }

    default:
      return { hardfork: 'berlin', network_id: 31337 }
  }
}


/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.19",
  defaultNetwork: 'sepolia',
  etherscan: {
    apiKey:   {
      mainnet: process.env.MAINNET_SCAN_API_KEY,
      sepolia: process.env.MAINNET_SCAN_API_KEY,
      polygonMumbai: process.env.POLYGON_SCAN_API_KEY,
      mumbai: process.env.POLYGON_SCAN_API_KEY,
    },
    optimizer: {
      enabled: true,
      runs:    10000
    }
  },
  networks: {
    hardhat: hardhatNetwork(),
    sepolia: {
      url: "https://ethereum-sepolia.publicnode.com",
      // url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_SEPOLIA_API_KEY}`,
      accounts: accounts(),

    },
    mumbai: {
      url: "https://polygon-mumbai-bor.publicnode.com",
      accounts: accounts(),
    }
  },
  mocha: JSON.parse(fs.readFileSync('.mocharc.json'))
};

module.exports = config;
