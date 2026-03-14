const hre = require("hardhat");

const getGasPriceWei = async (provider) => {
  const fromEnv = process.env.HEDERA_TESTNET_GAS_PRICE_WEI || process.env.HEDERA_MAINNET_GAS_PRICE_WEI;
  if (fromEnv) return BigInt(fromEnv);
  try {
    const fee = await provider.getFeeData();
    if (fee.gasPrice && fee.gasPrice > 0n) return (fee.gasPrice * 3n) / 2n;
  } catch {}
  return 1500000000000n;
};

const txOverrides = (gasPriceWei, gasLimit) => ({
  type: 0,
  gasPrice: gasPriceWei,
  gasLimit,
});

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer. Set PRIVATE_KEY in contracts/.env");
  }
  const gasPriceWei = await getGasPriceWei(deployer.provider);

  const assetAddress = process.env.USDC_ADDRESS;
  if (!assetAddress) {
    throw new Error("Missing USDC_ADDRESS in contracts/.env");
  }
  const code = await deployer.provider.getCode(assetAddress);
  if (!code || code === "0x") {
    throw new Error(`USDC_ADDRESS has no contract code on ${hre.network.name}: ${assetAddress}`);
  }

  const owner = process.env.PRIZE_POOL_OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Asset:", assetAddress);
  console.log("Prize pool owner:", owner);
  console.log("Using gasPrice (wei):", gasPriceWei.toString());

  const PrizeSavingsPool = await hre.ethers.getContractFactory("PrizeSavingsPool");
  const prizePool = await PrizeSavingsPool.deploy(assetAddress, owner, txOverrides(gasPriceWei, 7000000n));
  await prizePool.waitForDeployment();

  const tx = prizePool.deploymentTransaction();
  if (tx) {
    const receipt = await tx.wait();
    console.log("PrizeSavingsPool deploy tx:", tx.hash);
    console.log("PrizeSavingsPool block:", receipt?.blockNumber ?? "unknown");
  }

  console.log("PrizeSavingsPool:", await prizePool.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
