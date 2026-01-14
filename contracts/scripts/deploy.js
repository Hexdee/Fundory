const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer. Set PRIVATE_KEY in contracts/.env");
  }

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

  const usdcAddress = process.env.USDC_ADDRESS;
  const mintTo = process.env.MINT_TO;
  const mintAmount = process.env.MINT_AMOUNT;
  const strategyAprA = Number(process.env.STRATEGY_APR_BPS_A || 500);
  const strategyAprB = Number(process.env.STRATEGY_APR_BPS_B || 1000);

  let assetAddress = usdcAddress;

  if (!assetAddress) {
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy();
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
  }

  const MockYieldStrategy = await hre.ethers.getContractFactory("MockYieldStrategy");
  const strategyStable = await MockYieldStrategy.deploy(assetAddress, strategyAprA);
  await strategyStable.waitForDeployment();
  const strategyGrowth = await MockYieldStrategy.deploy(assetAddress, strategyAprB);
  await strategyGrowth.waitForDeployment();

  console.log("MockYieldStrategy Stable:", await strategyStable.getAddress(), `APR ${strategyAprA} bps`);
  await logDeployment("MockYieldStrategy Stable", strategyStable);
  console.log("MockYieldStrategy Growth:", await strategyGrowth.getAddress(), `APR ${strategyAprB} bps`);
  await logDeployment("MockYieldStrategy Growth", strategyGrowth);

  const GoalVaultFactory = await hre.ethers.getContractFactory("GoalVaultFactory");
  const factory = await GoalVaultFactory.deploy(assetAddress);
  await factory.waitForDeployment();

  console.log("GoalVaultFactory:", await factory.getAddress());
  await logDeployment("GoalVaultFactory", factory);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
