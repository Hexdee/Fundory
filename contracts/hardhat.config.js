require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

const mantleRpcUrl = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const mantleTestnetRpcUrl = process.env.MANTLE_TESTNET_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const mantleSepoliaRpcUrl = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const privateKey = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.20",
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    mantle: {
      url: mantleRpcUrl,
      chainId: 5000,
      accounts: privateKey ? [privateKey] : [],
    },
    mantleTestnet: {
      url: mantleTestnetRpcUrl,
      chainId: 5003,
      accounts: privateKey ? [privateKey] : [],
    },
    mantleSepolia: {
      url: mantleSepoliaRpcUrl,
      chainId: 5003,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};
