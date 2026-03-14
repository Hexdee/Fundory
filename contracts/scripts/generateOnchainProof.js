const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const getExplorerBase = (chainId) => {
  if (chainId === 296) return "https://hashscan.io/testnet/transaction";
  if (chainId === 295) return "https://hashscan.io/mainnet/transaction";
  return "";
};

const withExplorer = (txHash, chainId) => {
  const base = getExplorerBase(chainId);
  return base ? `${base}/${txHash}` : null;
};

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
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Missing signer");
  const gasPriceWei = await getGasPriceWei(signer.provider);

  const factoryAddress = process.env.FACTORY_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const strategyAddress = process.env.STRATEGY_ADDRESS;
  const hederaAccountId = process.env.HEDERA_ACCOUNT_ID || null;

  if (!factoryAddress || !usdcAddress || !strategyAddress) {
    throw new Error("Set FACTORY_ADDRESS, USDC_ADDRESS, STRATEGY_ADDRESS");
  }

  const factory = await hre.ethers.getContractAt("GoalVaultFactory", factoryAddress, signer);
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress, signer);

  const decimals = Number(await usdc.decimals());
  const target = hre.ethers.parseUnits(process.env.TARGET_AMOUNT || "1000", decimals);
  const mintAmount = hre.ethers.parseUnits(process.env.MINT_AMOUNT || "500", decimals);
  const depositAmount = hre.ethers.parseUnits(process.env.DEPOSIT_AMOUNT || "250", decimals);
  const goalMode = Number(process.env.GOAL_MODE || 1);
  const goalName = process.env.GOAL_NAME || "Submission Proof Goal";

  const createTx = await factory.createGoal(
    goalName,
    target,
    strategyAddress,
    goalMode,
    txOverrides(gasPriceWei, 6000000n)
  );
  const createReceipt = await createTx.wait();

  const goalId = await factory.goalCount();
  const goal = await factory.goals(goalId);
  const vault = await hre.ethers.getContractAt("GoalVault", goal.vault, signer);

  let mintTxHash = null;
  try {
    const mintTx = await usdc.mint(signer.address, mintAmount, txOverrides(gasPriceWei, 1000000n));
    await mintTx.wait();
    mintTxHash = mintTx.hash;
  } catch (err) {
    console.warn("Mint skipped (token may not be mock mintable):", err?.shortMessage || err?.message || err);
  }

  const balance = await usdc.balanceOf(signer.address);
  if (balance < depositAmount) {
    throw new Error(
      `Insufficient token balance for deposit. Have=${balance.toString()} Need=${depositAmount.toString()}`
    );
  }

  const approveTx = await usdc.approve(goal.vault, depositAmount, txOverrides(gasPriceWei, 800000n));
  await approveTx.wait();

  const depositTx = await vault.deposit(depositAmount, txOverrides(gasPriceWei, 3000000n));
  await depositTx.wait();

  const totalAssets = await vault.totalAssets();
  if (totalAssets <= 0n) {
    throw new Error("Expected vault totalAssets > 0 after deposit");
  }

  const network = await signer.provider.getNetwork();
  const chainId = Number(network.chainId);

  const proof = {
    generatedAt: new Date().toISOString(),
    network: hre.network.name,
    chainId,
    account: {
      evmAddress: signer.address,
      hederaAccountId,
    },
    goal: {
      id: goalId.toString(),
      name: goal.name,
      mode: Number(goal.mode),
      vault: goal.vault,
      strategy: goal.strategy,
      targetAmount: goal.targetAmount.toString(),
      totalAssets: totalAssets.toString(),
    },
    transactions: {
      createGoal: {
        hash: createTx.hash,
        blockNumber: createReceipt?.blockNumber ?? null,
        explorer: withExplorer(createTx.hash, chainId),
      },
      mint: mintTxHash
        ? {
            hash: mintTxHash,
            explorer: withExplorer(mintTxHash, chainId),
          }
        : null,
      approve: {
        hash: approveTx.hash,
        explorer: withExplorer(approveTx.hash, chainId),
      },
      deposit: {
        hash: depositTx.hash,
        explorer: withExplorer(depositTx.hash, chainId),
      },
    },
  };

  const outputPath = path.resolve(__dirname, "../../submission/onchain-proof.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(proof, null, 2));

  console.log(JSON.stringify({ outputPath, proof }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
