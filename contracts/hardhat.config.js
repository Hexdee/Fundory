require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

const evmMainnetRpcUrl = process.env.EVM_MAINNET_RPC_URL || process.env.LEGACY_MAINNET_RPC_URL || "https://rpc.invalid";
const evmTestnetRpcUrl = process.env.EVM_TESTNET_RPC_URL || process.env.LEGACY_TESTNET_RPC_URL || "https://rpc.invalid";
const evmSepoliaRpcUrl = process.env.EVM_SEPOLIA_RPC_URL || process.env.LEGACY_SEPOLIA_RPC_URL || "https://rpc.invalid";
const hederaRpcUrl = process.env.HEDERA_RPC_URL || "https://mainnet.hashio.io/api";
const hederaTestnetRpcUrl = process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api";
const hederaMainnetGasPrice = Number(process.env.HEDERA_MAINNET_GAS_PRICE_WEI || "1000000000000");
const hederaTestnetGasPrice = Number(process.env.HEDERA_TESTNET_GAS_PRICE_WEI || "1000000000000");
const hederaGasMultiplier = Number(process.env.HEDERA_GAS_MULTIPLIER || "1.3");
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
    evmMainnet: {
      url: evmMainnetRpcUrl,
      chainId: 5000,
      accounts: privateKey ? [privateKey] : [],
    },
    evmTestnet: {
      url: evmTestnetRpcUrl,
      chainId: 5003,
      accounts: privateKey ? [privateKey] : [],
    },
    evmSepolia: {
      url: evmSepoliaRpcUrl,
      chainId: 5003,
      accounts: privateKey ? [privateKey] : [],
    },
    hedera: {
      url: hederaRpcUrl,
      chainId: 295,
      accounts: privateKey ? [privateKey] : [],
      gasPrice: hederaMainnetGasPrice,
      gasMultiplier: hederaGasMultiplier,
    },
    hederaTestnet: {
      url: hederaTestnetRpcUrl,
      chainId: 296,
      accounts: privateKey ? [privateKey] : [],
      gasPrice: hederaTestnetGasPrice,
      gasMultiplier: hederaGasMultiplier,
    },
  },
};
