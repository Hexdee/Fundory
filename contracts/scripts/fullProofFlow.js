const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const getHashscanTxBase = (chainId) => {
  if (chainId === 296) return "https://hashscan.io/testnet/transaction";
  if (chainId === 295) return "https://hashscan.io/mainnet/transaction";
  return "";
};

const getMirrorBase = (chainId) => {
  if (chainId === 296) return "https://testnet.mirrornode.hedera.com";
  if (chainId === 295) return "https://mainnet-public.mirrornode.hedera.com";
  return "";
};

const txLink = (txHash, chainId) => {
  const base = getHashscanTxBase(chainId);
  return base ? `${base}/${txHash}` : null;
};

const withTimeout = async (promise, ms = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const resolveHederaAccountId = async (chainId, evmAddress) => {
  const mirrorBase = getMirrorBase(chainId);
  if (!mirrorBase) return null;
  try {
    const res = await withTimeout((signal) =>
      fetch(`${mirrorBase}/api/v1/accounts/${evmAddress}`, { signal })
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.account || null;
  } catch {
    return null;
  }
};

const getGasPriceWei = async (provider) => {
  const fromEnv = process.env.HEDERA_TESTNET_GAS_PRICE_WEI || process.env.HEDERA_MAINNET_GAS_PRICE_WEI;
  if (fromEnv) return BigInt(fromEnv);
  try {
    const current = await provider.getFeeData();
    if (current.gasPrice && current.gasPrice > 0n) {
      return (current.gasPrice * 3n) / 2n;
    }
  } catch {}
  return 1500000000000n;
};

const txOverrides = (gasPriceWei, gasLimit) => ({
  type: 0,
  gasPrice: gasPriceWei,
  gasLimit,
});

const waitDeployment = async (label, contract) => {
  await contract.waitForDeployment();
  const tx = contract.deploymentTransaction();
  const receipt = tx ? await tx.wait() : null;
  const address = await contract.getAddress();
  return {
    label,
    address,
    txHash: tx?.hash || null,
    blockNumber: receipt?.blockNumber ?? null,
  };
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Missing signer. Set PRIVATE_KEY in contracts/.env");

  const chainId = Number((await signer.provider.getNetwork()).chainId);
  const gasPriceWei = await getGasPriceWei(signer.provider);
  const targetAmountInput = process.env.TARGET_AMOUNT || "1000";
  const mintAmountInput = process.env.MINT_AMOUNT || "500";
  const depositAmountInput = process.env.DEPOSIT_AMOUNT || "250";
  const goalName = process.env.GOAL_NAME || "Fundory Submission Proof Goal";
  const goalMode = Number(process.env.GOAL_MODE || 1);
  const stableApr = Number(process.env.STRATEGY_APR_BPS_A || 500);
  const growthApr = Number(process.env.STRATEGY_APR_BPS_B || 1000);
  const strategyChoice = (process.env.STRATEGY_CHOICE || "stable").toLowerCase();

  if (goalMode < 0 || goalMode > 2) {
    throw new Error("GOAL_MODE must be 0, 1, or 2");
  }

  console.log("Signer:", signer.address);
  console.log("Network:", hre.network.name, "ChainId:", chainId);
  console.log("Using gasPrice (wei):", gasPriceWei.toString());

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy(txOverrides(gasPriceWei, 5000000n));
  const usdcInfo = await waitDeployment("MockUSDC", mockUsdc);
  console.log("MockUSDC:", usdcInfo.address);

  const MockYieldStrategy = await hre.ethers.getContractFactory("MockYieldStrategy");
  const strategyStable = await MockYieldStrategy.deploy(
    usdcInfo.address,
    stableApr,
    txOverrides(gasPriceWei, 6000000n)
  );
  const stableInfo = await waitDeployment("MockYieldStrategyStable", strategyStable);
  console.log("StrategyStable:", stableInfo.address, `APR=${stableApr}bps`);

  const strategyGrowth = await MockYieldStrategy.deploy(
    usdcInfo.address,
    growthApr,
    txOverrides(gasPriceWei, 6000000n)
  );
  const growthInfo = await waitDeployment("MockYieldStrategyGrowth", strategyGrowth);
  console.log("StrategyGrowth:", growthInfo.address, `APR=${growthApr}bps`);

  const GoalVaultFactory = await hre.ethers.getContractFactory("GoalVaultFactory");
  const factory = await GoalVaultFactory.deploy(usdcInfo.address, txOverrides(gasPriceWei, 12000000n));
  const factoryInfo = await waitDeployment("GoalVaultFactory", factory);
  console.log("GoalVaultFactory:", factoryInfo.address);

  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcInfo.address, signer);
  const decimals = Number(await usdc.decimals());
  const targetAmount = hre.ethers.parseUnits(targetAmountInput, decimals);
  const mintAmount = hre.ethers.parseUnits(mintAmountInput, decimals);
  const depositAmount = hre.ethers.parseUnits(depositAmountInput, decimals);

  const selectedStrategy =
    strategyChoice === "growth" ? growthInfo.address : stableInfo.address;

  const createTx = await factory.createGoal(
    goalName,
    targetAmount,
    selectedStrategy,
    goalMode,
    txOverrides(gasPriceWei, 6000000n)
  );
  const createReceipt = await createTx.wait();

  const goalId = await factory.goalCount();
  const goal = await factory.goals(goalId);
  const vault = await hre.ethers.getContractAt("GoalVault", goal.vault, signer);

  const mintTx = await usdc.mint(signer.address, mintAmount, txOverrides(gasPriceWei, 1000000n));
  await mintTx.wait();

  const approveTx = await usdc.approve(goal.vault, depositAmount, txOverrides(gasPriceWei, 800000n));
  await approveTx.wait();

  const depositTx = await vault.deposit(depositAmount, txOverrides(gasPriceWei, 3000000n));
  const depositReceipt = await depositTx.wait();

  const totalAssets = await vault.totalAssets();
  if (totalAssets <= 0n) {
    throw new Error("Expected totalAssets > 0 after deposit");
  }

  const hederaAccountId = await resolveHederaAccountId(chainId, signer.address);

  const proof = {
    generatedAt: new Date().toISOString(),
    network: hre.network.name,
    chainId,
    account: {
      evmAddress: signer.address,
      hederaAccountId,
    },
    contracts: {
      usdc: usdcInfo,
      strategyStable: stableInfo,
      strategyGrowth: growthInfo,
      factory: factoryInfo,
      selectedStrategy,
    },
    goal: {
      id: goalId.toString(),
      name: goal.name,
      mode: Number(goal.mode),
      vault: goal.vault,
      targetAmount: goal.targetAmount.toString(),
      totalAssets: totalAssets.toString(),
    },
    transactions: {
      createGoal: {
        hash: createTx.hash,
        blockNumber: createReceipt?.blockNumber ?? null,
        explorer: txLink(createTx.hash, chainId),
      },
      mint: {
        hash: mintTx.hash,
        explorer: txLink(mintTx.hash, chainId),
      },
      approve: {
        hash: approveTx.hash,
        explorer: txLink(approveTx.hash, chainId),
      },
      deposit: {
        hash: depositTx.hash,
        blockNumber: depositReceipt?.blockNumber ?? null,
        explorer: txLink(depositTx.hash, chainId),
      },
    },
  };

  const submissionDir = path.resolve(__dirname, "../../submission");
  fs.mkdirSync(submissionDir, { recursive: true });

  const latestPath = path.join(submissionDir, "onchain-proof.json");
  fs.writeFileSync(latestPath, JSON.stringify(proof, null, 2));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(submissionDir, `onchain-proof-${timestamp}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(proof, null, 2));

  console.log(
    JSON.stringify(
      {
        outputLatest: latestPath,
        outputArchive: archivePath,
        hederaAccountId,
        proof,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
