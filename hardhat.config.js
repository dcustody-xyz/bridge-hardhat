const { HardhatUserConfig, extendEnvironment } = require("hardhat/config");
const { createProvider } = require("hardhat/internal/core/providers/construction");
const fs = require('fs')

require('@nomicfoundation/hardhat-chai-matchers')
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
// const tdly = require("@tenderly/hardhat-tenderly");
// tdly.setup();

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
    return [process.env.PRIVATE_KEY]
  else
    return []
}

const hardhatNetwork = () => {
  chain = process.env.HARDHAT_INTEGRATION_CHAIN
  chain = isNaN(chain) ? chain?.toLowerCase() : +chain

  switch (chain) {
    case 1:
      return {
        chainId:       1,
        gasMultiplier: 5,
        forking:       {
          url:           `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_KEY}`,
          gasMultiplier: 5,
          blockNumber:   14980909
        }
      }
    case 10:
      return {
        chainId:       10,
        gasMultiplier: 5,
        forking:       {
          url:           `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_OPTIMISM_KEY}`,
          gasMultiplier: 5,
          blockNumber:   (+process.env.BLOCK || 22562704)
        }
      }
    case 56:
      return {
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
        chainId:       137,
        gasMultiplier: 10,
        forking:       {
          url:           `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_POLYGON_KEY}`,
          gasMultiplier: 10,
          blockNumber:   (+process.env.BLOCK || 19880876)
          // blockNumber:   28401104
          // blockNumber:    24479611 // test for balancer
        }
      }
    case 80001, 'mumbai':
      return {
        chainId:       80001,
        gasMultiplier: 5,
        forking:       {
          url:           `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_MUMBAI_KEY}`,
          gasMultiplier: 5,
          blockNumber:   +process.env.BLOCK_NUMBER || 41300000
        }
      }
    case 11155111, 'sepolia':
      return {
        chainId:       11155111,
        accounts: accounts(true),
        forking: {
          url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_SEPOLIA_KEY}`,
          blockNumber: 4503700,
        }
      }

    default:
      return { hardfork: 'berlin', chainId: 31337 }
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
    tenderly: {
      chainId: 80001,
      url: "https://rpc.tenderly.co/fork/81d06c41-307a-4a55-a9cf-b0587eb06e96" // mumbai
    },
    sepolia: {
      url: "https://ethereum-sepolia.publicnode.com",
      accounts: accounts(),

    },
    mumbai: {
      url: "https://polygon-mumbai-bor.publicnode.com",
      accounts: accounts(),
    }
  },
  mocha: JSON.parse(fs.readFileSync('.mocharc.json')),
  tenderly: { // as before
    username: "Shelvak",
    project: "Project",
    privateVerification: false
  }
};

module.exports = config;
