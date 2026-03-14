const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Missing signer");

  const factoryAddress = process.env.FACTORY_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const strategyAddress = process.env.STRATEGY_ADDRESS;

  if (!factoryAddress || !usdcAddress || !strategyAddress) {
    throw new Error("Set FACTORY_ADDRESS, USDC_ADDRESS, STRATEGY_ADDRESS");
  }

  const factory = await hre.ethers.getContractAt("GoalVaultFactory", factoryAddress, signer);
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress, signer);

  const target = hre.ethers.parseUnits("1000", 6);
  const createTx = await factory.createGoal("E2E Smoke Goal", target, strategyAddress, 1);
  await createTx.wait();

  const goalId = await factory.goalCount();
  const goal = await factory.goals(goalId);
  const vault = await hre.ethers.getContractAt("GoalVault", goal.vault, signer);

  const mintTx = await usdc.mint(signer.address, hre.ethers.parseUnits("500", 6));
  await mintTx.wait();

  const approveTx = await usdc.approve(goal.vault, hre.ethers.parseUnits("500", 6));
  await approveTx.wait();

  const depositTx = await vault.deposit(hre.ethers.parseUnits("250", 6));
  await depositTx.wait();

  const totalAssets = await vault.totalAssets();
  if (totalAssets <= 0n) {
    throw new Error("Expected vault totalAssets > 0 after deposit");
  }
  if (Number(goal.mode) !== 1) {
    throw new Error(`Expected mode=1 on-chain, got ${goal.mode.toString()}`);
  }

  const result = {
    chainId: Number((await signer.provider.getNetwork()).chainId),
    owner: signer.address,
    goalId: goalId.toString(),
    mode: goal.mode.toString(),
    vault: goal.vault,
    strategy: goal.strategy,
    totalAssets: totalAssets.toString(),
    txHash: depositTx.hash,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

