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

  const assetAddress = process.env.USDC_ADDRESS;
  if (!assetAddress) throw new Error("Set USDC_ADDRESS to the target token");
  const assetCode = await deployer.provider.getCode(assetAddress);
  if (!assetCode || assetCode === "0x") {
    throw new Error(`USDC_ADDRESS has no contract code on ${hre.network.name}: ${assetAddress}`);
  }

  const strategyAprA = Number(process.env.STRATEGY_APR_BPS_A || 500);
  const strategyAprB = Number(process.env.STRATEGY_APR_BPS_B || 1000);
  const strategyType = (process.env.STRATEGY_TYPE || "real").toLowerCase();
  const useMockStrategy = strategyType === "mock";
  const strategyLabel = useMockStrategy ? "MockYieldStrategy" : "SponsoredYieldStrategy";

  const gasPriceWei = await getGasPriceWei(deployer.provider);

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Asset:", assetAddress);
  console.log("Strategy Type:", strategyLabel);
  console.log("Using gasPrice (wei):", gasPriceWei.toString());

  const Strategy = await hre.ethers.getContractFactory(strategyLabel);

  const stable = useMockStrategy
    ? await Strategy.deploy(assetAddress, strategyAprA, txOverrides(gasPriceWei, 6000000n))
    : await Strategy.deploy(assetAddress, strategyAprA, deployer.address, txOverrides(gasPriceWei, 6000000n));
  await stable.waitForDeployment();

  const growth = useMockStrategy
    ? await Strategy.deploy(assetAddress, strategyAprB, txOverrides(gasPriceWei, 6000000n))
    : await Strategy.deploy(assetAddress, strategyAprB, deployer.address, txOverrides(gasPriceWei, 6000000n));
  await growth.waitForDeployment();

  console.log("Strategy Stable:", await stable.getAddress(), `APR ${strategyAprA} bps`);
  console.log("Strategy Growth:", await growth.getAddress(), `APR ${strategyAprB} bps`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
