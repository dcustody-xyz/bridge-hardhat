const { HardhatUserConfig, extendEnvironment } = require("hardhat/config");
const { createProvider } = require("hardhat/internal/core/providers/construction");

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
    sepolia: {
      url: "https://ethereum-sepolia.publicnode.com",
      accounts: [process.env.PRIVATE_KEY], // testnet private key

    },
    mumbai: {
      url: "https://polygon-mumbai-bor.publicnode.com",
      accounts: [process.env.PRIVATE_KEY], // testnet private key
    }
  }
};

module.exports = config;
