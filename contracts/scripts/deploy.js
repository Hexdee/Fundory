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

  const logDeployment = async (label, contract) => {
    const tx = contract.deploymentTransaction();
    if (!tx) {
      console.log(`${label} deployed`);
      return;
    }
    const receipt = await tx.wait();
    console.log(`${label} deploy tx:`, tx.hash);
    console.log(`${label} block:`, receipt?.blockNumber ?? "unknown");
  };

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Using gasPrice (wei):", gasPriceWei.toString());

  const usdcAddress = process.env.USDC_ADDRESS;
  const mintTo = process.env.MINT_TO;
  const mintAmount = process.env.MINT_AMOUNT;
  const strategyAprA = Number(process.env.STRATEGY_APR_BPS_A || 500);
  const strategyAprB = Number(process.env.STRATEGY_APR_BPS_B || 1000);
  const strategyType = (process.env.STRATEGY_TYPE || "real").toLowerCase();

  let assetAddress = usdcAddress;

  if (!assetAddress) {
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy(txOverrides(gasPriceWei, 5000000n));
    await mock.waitForDeployment();
    assetAddress = await mock.getAddress();
    console.log("MockUSDC:", assetAddress);
    await logDeployment("MockUSDC", mock);

    if (mintTo && mintAmount && mintAmount !== "0") {
      const mintTx = await mock.mint(mintTo, mintAmount);
      await mintTx.wait();
      console.log("Minted", mintAmount, "to", mintTo);
    }
  } else {
    console.log("Using existing USDC:", assetAddress);
    const code = await deployer.provider.getCode(assetAddress);
    if (!code || code === "0x") {
      throw new Error(`USDC_ADDRESS has no contract code on ${hre.network.name}: ${assetAddress}`);
    }
  }

  const useMockStrategy = strategyType === "mock";
  const strategyLabel = useMockStrategy ? "MockYieldStrategy" : "SponsoredYieldStrategy";

  const strategyFactory = await hre.ethers.getContractFactory(strategyLabel);
  const strategyStable = useMockStrategy
    ? await strategyFactory.deploy(assetAddress, strategyAprA, txOverrides(gasPriceWei, 6000000n))
    : await strategyFactory.deploy(
        assetAddress,
        strategyAprA,
        deployer.address,
        txOverrides(gasPriceWei, 6000000n)
      );
  await strategyStable.waitForDeployment();

  const strategyGrowth = useMockStrategy
    ? await strategyFactory.deploy(assetAddress, strategyAprB, txOverrides(gasPriceWei, 6000000n))
    : await strategyFactory.deploy(
        assetAddress,
        strategyAprB,
        deployer.address,
        txOverrides(gasPriceWei, 6000000n)
      );
  await strategyGrowth.waitForDeployment();

  console.log(`${strategyLabel} Stable:`, await strategyStable.getAddress(), `APR ${strategyAprA} bps`);
  await logDeployment(`${strategyLabel} Stable`, strategyStable);
  console.log(`${strategyLabel} Growth:`, await strategyGrowth.getAddress(), `APR ${strategyAprB} bps`);
  await logDeployment(`${strategyLabel} Growth`, strategyGrowth);

  const GoalVaultFactory = await hre.ethers.getContractFactory("GoalVaultFactory");
  const factory = await GoalVaultFactory.deploy(assetAddress, txOverrides(gasPriceWei, 12000000n));
  await factory.waitForDeployment();

  console.log("GoalVaultFactory:", await factory.getAddress());
  await logDeployment("GoalVaultFactory", factory);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
