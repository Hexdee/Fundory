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
  if (!deployer) throw new Error("Missing deployer");

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) throw new Error("Set USDC_ADDRESS in contracts/.env");

  const code = await deployer.provider.getCode(usdcAddress);
  if (!code || code === "0x") {
    throw new Error(`USDC_ADDRESS has no contract code on ${hre.network.name}: ${usdcAddress}`);
  }

  const gasPriceWei = await getGasPriceWei(deployer.provider);
  const gasLimit = BigInt(process.env.GAS_LIMIT_FACTORY_DEPLOY || "12000000");

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("USDC:", usdcAddress);
  console.log("Using gasPrice (wei):", gasPriceWei.toString());
  console.log("Using gasLimit:", gasLimit.toString());

  const GoalVaultFactory = await hre.ethers.getContractFactory("GoalVaultFactory");
  const factory = await GoalVaultFactory.deploy(usdcAddress, txOverrides(gasPriceWei, gasLimit));
  await factory.waitForDeployment();
  const address = await factory.getAddress();
  const tx = factory.deploymentTransaction();
  const receipt = tx ? await tx.wait() : null;

  console.log("GoalVaultFactory:", address);
  if (tx) {
    console.log("Deploy tx:", tx.hash);
    console.log("Block:", receipt?.blockNumber ?? "unknown");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
