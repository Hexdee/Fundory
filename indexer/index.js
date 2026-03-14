const fs = require("fs");
const path = require("path");
const express = require("express");
const {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  parseUnits,
  getAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "";
const START_BLOCK = BigInt(process.env.START_BLOCK || 0);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 12000);
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 1000);
const MAX_LOG_RANGE = BigInt(Math.min(Number(process.env.MAX_LOG_RANGE || 20000), 30000));
const PORT = Number(process.env.PORT || 8081);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const AGENT_ENABLED = process.env.AGENT_ENABLED !== "false";
const AGENT_AUTO_EXECUTE = process.env.AGENT_AUTO_EXECUTE === "true";
const AGENT_INTERVAL_MS = Number(process.env.AGENT_INTERVAL_MS || 300000);
const AGENT_CHAIN_ID = Number(process.env.AGENT_CHAIN_ID || 295);
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const AGENT_DEPOSIT_AMOUNT = process.env.AGENT_DEPOSIT_AMOUNT || "10";
const AGENT_MIN_REBALANCE_MS = Number(process.env.AGENT_MIN_REBALANCE_MS || 21600000);
const AGENT_SLIPPAGE_BPS = Math.min(Math.max(Number(process.env.AGENT_SLIPPAGE_BPS || 100), 0), 5000);
const AGENT_EXECUTE_API_KEY = process.env.AGENT_EXECUTE_API_KEY || "";
const AGENT_EXECUTE_HEADER = (process.env.AGENT_EXECUTE_HEADER || "x-agent-api-key").toLowerCase();
const AGENT_EXECUTOR = (process.env.AGENT_EXECUTOR || "viem").toLowerCase();
const AGENT_ACCOUNT_ID = process.env.AGENT_ACCOUNT_ID || process.env.ACCOUNT_ID || "";
const AGENT_HAK_TOKEN_SYMBOL = process.env.AGENT_HAK_TOKEN_SYMBOL || "USDC";
const AGENT_DEPOSIT_GUARD_ADDRESS =
  process.env.AGENT_DEPOSIT_GUARD_ADDRESS || "0xCEc8716cdd60856eaCaa74d499Abd14AE34B7dA8";
const AGENT_VAULT_DEPLOYER_ADDRESS =
  process.env.AGENT_VAULT_DEPLOYER_ADDRESS || "0xC159b19C5bd0E4a0709eC13C1303Ff2Bb67F7145";
const HEDERA_ERC20_WRAPPER_ADDRESS =
  process.env.HEDERA_ERC20_WRAPPER_ADDRESS || "0x000000000000000000000000000000000093A3A8";

const defaultStrategies = [
  {
    id: "bonzo_usdc_hbar_single",
    label: "Bonzo USDC/HBAR Single-Sided",
    kind: "dex_lp",
    risk: "low",
    vault: "0x1b90B8f8ab3059cf40924338D5292FfbAEd79089",
    depositToken: "0x000000000000000000000000000000000006f89a",
    note: "Stable-leaning LP strategy",
  },
  {
    id: "bonzo_usdc_sauce_dual",
    label: "Bonzo USDC/SAUCE Dual-Asset",
    kind: "dex_lp",
    risk: "high",
    vault: "0x0171d7e6B53A973eCd4742E66bF178d4A2B4546D",
    depositToken: "0x000000000000000000000000000000000006f89a",
    note: "Higher beta SAUCE exposure",
  },
  {
    id: "bonzo_sauce_xsauce_dual",
    label: "Bonzo SAUCE/xSAUCE",
    kind: "staking_lp",
    risk: "high",
    vault: "0x8AEE31D5f1901943Ff5A09A7839A5D2A98A21f3B",
    depositToken: "0x00000000000000000000000000000000000b2ad5",
    note: "Staking-linked SAUCE strategy",
  },
];

const parseStrategies = () => {
  if (!process.env.AGENT_STRATEGIES_JSON) return defaultStrategies;
  try {
    const parsed = JSON.parse(process.env.AGENT_STRATEGIES_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultStrategies;
    return parsed
      .map((s) => ({
        id: String(s.id || ""),
        label: String(s.label || s.id || "Strategy"),
        kind: String(s.kind || "dex_lp"),
        risk: String(s.risk || "low"),
        vault: String(s.vault || ""),
        depositToken: String(s.depositToken || ""),
        note: s.note ? String(s.note) : undefined,
      }))
      .filter((s) => s.id && s.vault && s.depositToken);
  } catch (err) {
    console.error("Invalid AGENT_STRATEGIES_JSON. Falling back to defaults.", err);
    return defaultStrategies;
  }
};

const AGENT_STRATEGIES = parseStrategies();

let hakRuntime = null;
let hakInitError = null;
let hakApiCache = null;
let hakApiCacheKey = "";
try {
  const hashgraphSdk = require("@hashgraph/sdk");
  const hak = require("hedera-agent-kit");
  const bonzoHak = require("@bonzofinancelabs/hak-bonzo-plugin");
  hakRuntime = {
    Client: hashgraphSdk.Client,
    PrivateKey: hashgraphSdk.PrivateKey,
    HederaLangchainToolkit: hak.HederaLangchainToolkit,
    AgentMode: hak.AgentMode,
    bonzoPlugin: bonzoHak.bonzoPlugin,
    bonzoPluginToolNames: bonzoHak.bonzoPluginToolNames,
  };
} catch (err) {
  hakInitError = err;
}

if (!RPC_URL) {
  throw new Error("Missing RPC_URL");
}

const statePath = path.join(__dirname, "state.json");

const defaultState = {
  meta: {
    rpcUrl: null,
    factoryAddress: null,
    chainId: null,
  },
  lastBlock: "0",
  vaults: {},
  activities: [],
  agent: {
    lastRunAt: null,
    lastDecision: null,
    lastExecution: null,
    lastExecutedStrategyId: null,
    history: [],
  },
};

const loadState = () => {
  if (!fs.existsSync(statePath)) return JSON.parse(JSON.stringify(defaultState));
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      meta: {
        ...defaultState.meta,
        ...(parsed.meta || {}),
      },
      agent: {
        ...defaultState.agent,
        ...(parsed.agent || {}),
        history: Array.isArray(parsed.agent?.history) ? parsed.agent.history : [],
      },
    };
  } catch (err) {
    console.error("Failed to read state file", err);
    return JSON.parse(JSON.stringify(defaultState));
  }
};

const saveState = (state) => {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
};

const state = loadState();

const client = createPublicClient({ transport: http(RPC_URL) });
const factoryAddress = FACTORY_ADDRESS ? getAddress(FACTORY_ADDRESS) : null;
const depositGuardAddress = AGENT_DEPOSIT_GUARD_ADDRESS ? getAddress(AGENT_DEPOSIT_GUARD_ADDRESS) : null;
const vaultDeployerAddress = AGENT_VAULT_DEPLOYER_ADDRESS ? getAddress(AGENT_VAULT_DEPLOYER_ADDRESS) : null;
const wrapperAddress = HEDERA_ERC20_WRAPPER_ADDRESS ? getAddress(HEDERA_ERC20_WRAPPER_ADDRESS) : null;

const hederaChain = {
  id: AGENT_CHAIN_ID,
  name: AGENT_CHAIN_ID === 296 ? "Hedera Testnet" : "Hedera Mainnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const agentAccount = AGENT_PRIVATE_KEY
  ? privateKeyToAccount(AGENT_PRIVATE_KEY.startsWith("0x") ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`)
  : null;

const walletClient = agentAccount
  ? createWalletClient({
      account: agentAccount,
      chain: hederaChain,
      transport: http(RPC_URL),
    })
  : null;

const goalCreatedEventV2 = parseAbiItem(
  "event GoalCreated(uint256 indexed goalId,address indexed owner,address vault,string name,uint256 targetAmount,address strategy,uint8 mode)"
);
const goalCreatedEventLegacy = parseAbiItem(
  "event GoalCreated(uint256 indexed goalId,address indexed owner,address vault,string name,uint256 targetAmount,address strategy)"
);
const depositEvent = parseAbiItem(
  "event Deposited(address indexed from,address indexed beneficiary,uint256 amount,uint256 sharesMinted)"
);
const withdrawEvent = parseAbiItem(
  "event Withdrawn(address indexed to,uint256 amount,uint256 sharesBurned)"
);

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

const depositGuardAbi = parseAbi([
  "function depositToICHIVaultAndTryWrapToHTS(address vault,address vaultDeployer,address token,uint256 erc20Amount,uint256 minimumProceeds,address to) returns (uint256 vaultTokens)",
  "function withdrawFromICHIVaultAndTryUnwrapToERC20(address vault,address vaultDeployer,uint256 shares,address to,uint256 minAmount0,uint256 minAmount1) returns (uint256 amount0,uint256 amount1)",
]);

const wrapperAbi = parseAbi([
  "function erc20Counterpart(address token) view returns (address)",
]);

const normalizeVault = (vault) => getAddress(vault);

let maxLogRange = MAX_LOG_RANGE;
let agentRunning = false;

const isLogRangeError = (err) => {
  const message = `${err?.details || ""} ${err?.shortMessage || ""} ${err?.message || ""}`;
  return (
    err?.status === 413 ||
    message.includes("max allowed range") ||
    message.includes("ErrGetLogsExceededMaxAllowedRange")
  );
};

const pushAgentHistory = (item) => {
  state.agent.history.unshift(item);
  state.agent.history = state.agent.history.slice(0, 120);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const nowIso = () => new Date().toISOString();
const requiresExecuteAuth = Boolean(AGENT_EXECUTE_API_KEY);

const getHakNetwork = () => (AGENT_CHAIN_ID === 296 ? "testnet" : "mainnet");

const normalizeEcdsaPrivateKey = (value) => {
  if (!value) return "";
  return value.startsWith("0x") ? value : `0x${value}`;
};

const ensureBonzoContractsFile = () => {
  const targetPath = path.resolve(process.cwd(), "bonzo-contracts.json");
  if (fs.existsSync(targetPath)) return targetPath;
  if (!hakRuntime) return null;

  try {
    const pluginEntry = require.resolve("@bonzofinancelabs/hak-bonzo-plugin");
    const pluginRoot = path.resolve(path.dirname(pluginEntry), "..");
    const sourcePath = path.join(pluginRoot, "bonzo-contracts.json");
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      return targetPath;
    }
    console.error("bonzo-contracts.json not found in Bonzo plugin package", sourcePath);
  } catch (err) {
    console.error("Failed to initialize bonzo-contracts.json for HAK plugin", err?.message || err);
  }
  return null;
};

const buildHakAgentApi = ({ requireSigner = false } = {}) => {
  if (!hakRuntime) {
    throw new Error(`Hedera Agent Kit not available: ${hakInitError?.message || "missing dependency"}`);
  }

  ensureBonzoContractsFile();

  const network = getHakNetwork();
  const signerKey = normalizeEcdsaPrivateKey(AGENT_PRIVATE_KEY);

  if (requireSigner) {
    if (!AGENT_ACCOUNT_ID) {
      throw new Error("Missing AGENT_ACCOUNT_ID for HAK autonomous execution");
    }
    if (!signerKey) {
      throw new Error("Missing AGENT_PRIVATE_KEY for HAK autonomous execution");
    }
  }

  const cacheKey = [
    network,
    requireSigner ? "signed" : "readonly",
    AGENT_ACCOUNT_ID || "",
    signerKey ? "pk_set" : "pk_missing",
  ].join("|");

  if (hakApiCache && hakApiCacheKey === cacheKey) {
    return hakApiCache;
  }

  const client =
    network === "testnet" ? hakRuntime.Client.forTestnet() : hakRuntime.Client.forMainnet();

  if (requireSigner) {
    const privateKeyObj = hakRuntime.PrivateKey.fromStringECDSA(signerKey);
    client.setOperator(AGENT_ACCOUNT_ID, privateKeyObj);
  }

  const toolkit = new hakRuntime.HederaLangchainToolkit({
    client,
    configuration: {
      context: {
        mode: hakRuntime.AgentMode.AUTONOMOUS,
        ...(AGENT_ACCOUNT_ID ? { accountId: AGENT_ACCOUNT_ID } : {}),
      },
      plugins: [hakRuntime.bonzoPlugin],
      tools: [],
    },
  });

  hakApiCache = {
    api: toolkit.getHederaAgentKitAPI(),
    toolNames: hakRuntime.bonzoPluginToolNames,
    network,
    signerConfigured: Boolean(requireSigner && AGENT_ACCOUNT_ID && signerKey),
  };
  hakApiCacheKey = cacheKey;
  return hakApiCache;
};

const parseHakOutput = (output) => {
  if (typeof output !== "string") return { raw: output, text: String(output || "") };
  const trimmed = output.trim();
  if (!trimmed) return { raw: "", text: "" };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return { raw: parsed, text: parsed };
    }
    const preferredText =
      typeof parsed?.humanMessage === "string" ? parsed.humanMessage : trimmed;
    return { raw: parsed, text: preferredText };
  } catch {
    return { raw: trimmed, text: trimmed };
  }
};

const runHakTool = async ({ toolName, params, requireSigner = false }) => {
  const { api } = buildHakAgentApi({ requireSigner });
  const output = await api.run(toolName, params || {});
  return parseHakOutput(output);
};

const isExecuteAuthorized = (req) => {
  if (!requiresExecuteAuth) return true;
  const headerValue = req.header(AGENT_EXECUTE_HEADER) || req.header("x-agent-api-key");
  return headerValue === AGENT_EXECUTE_API_KEY;
};

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const floored = Math.floor(parsed);
  return typeof max === "number" ? Math.min(floored, max) : floored;
};

const normalizeAddressLower = (value) => {
  if (!value) return null;
  try {
    return getAddress(value).toLowerCase();
  } catch {
    return null;
  }
};

const initializeStateMeta = async () => {
  const chainId = await client.getChainId();
  const currentMeta = {
    rpcUrl: RPC_URL,
    factoryAddress: normalizeAddressLower(factoryAddress),
    chainId: String(chainId),
  };

  const previousMeta = state.meta || defaultState.meta;
  const changed =
    previousMeta.rpcUrl !== currentMeta.rpcUrl ||
    previousMeta.factoryAddress !== currentMeta.factoryAddress ||
    previousMeta.chainId !== currentMeta.chainId;

  if (changed) {
    console.warn("Indexer state reset due environment change", {
      previous: previousMeta,
      current: currentMeta,
    });
    state.lastBlock = "0";
    state.vaults = {};
    state.activities = [];
    state.agent = JSON.parse(JSON.stringify(defaultState.agent));
  }

  state.meta = currentMeta;
  saveState(state);
};

const getLogsInChunks = async ({ address, event, fromBlock, toBlock }) => {
  if (fromBlock > toBlock) return [];
  const logs = [];
  let start = fromBlock;
  let range = maxLogRange;
  while (start <= toBlock) {
    const end = start + range - 1n <= toBlock ? start + range - 1n : toBlock;
    try {
      const batch = await client.getLogs({
        address,
        event,
        fromBlock: start,
        toBlock: end,
      });
      if (batch.length) logs.push(...batch);
      start = end + 1n;
      range = maxLogRange;
    } catch (err) {
      if (isLogRangeError(err) && range > 1n) {
        const nextRange = range / 2n;
        range = nextRange > 1n ? nextRange : 1n;
        maxLogRange = range;
        continue;
      }
      throw err;
    }
  }
  return logs;
};

const indexOnce = async () => {
  if (!factoryAddress) return;

  const latestBlock = await client.getBlockNumber();
  const lastBlock = state.lastBlock ? BigInt(state.lastBlock) : 0n;

  if (lastBlock > latestBlock) {
    console.warn("Detected chain rollback/reset, rewinding indexer state", {
      lastBlock: lastBlock.toString(),
      latestBlock: latestBlock.toString(),
    });
    state.lastBlock = "0";
    state.vaults = {};
    state.activities = [];
    saveState(state);
    return;
  }

  const fromBlock = lastBlock > 0n ? lastBlock + 1n : START_BLOCK;

  if (fromBlock > latestBlock) return;

  const [goalLogsV2, goalLogsLegacy] = await Promise.all([
    getLogsInChunks({
      address: factoryAddress,
      event: goalCreatedEventV2,
      fromBlock,
      toBlock: latestBlock,
    }),
    getLogsInChunks({
      address: factoryAddress,
      event: goalCreatedEventLegacy,
      fromBlock,
      toBlock: latestBlock,
    }),
  ]);
  const goalLogs = [...goalLogsV2, ...goalLogsLegacy];

  goalLogs.forEach((log) => {
    const vault = normalizeVault(log.args.vault);
    state.vaults[vault] = {
      goalId: log.args.goalId.toString(),
      owner: log.args.owner,
      name: log.args.name,
      targetAmount: log.args.targetAmount.toString(),
      strategy: log.args.strategy,
      mode: typeof log.args.mode === "number" ? Number(log.args.mode) : 0,
    };
  });

  const vaultAddresses = Object.keys(state.vaults);
  if (vaultAddresses.length) {
    const newEvents = [];
    const existingIds = new Set(state.activities.map((item) => item.id));

    for (const vault of vaultAddresses) {
      const [depositLogs, withdrawLogs] = await Promise.all([
        getLogsInChunks({
          address: vault,
          event: depositEvent,
          fromBlock,
          toBlock: latestBlock,
        }),
        getLogsInChunks({
          address: vault,
          event: withdrawEvent,
          fromBlock,
          toBlock: latestBlock,
        }),
      ]);

      depositLogs.forEach((log) => {
        if (!log.transactionHash || !log.blockNumber) return;
        const id = `${log.transactionHash}-${log.logIndex}`;
        if (existingIds.has(id)) return;
        newEvents.push({
          id,
          type: "Deposit",
          amount: log.args.amount.toString(),
          vault,
          goalName: state.vaults[vault]?.name,
          blockNumber: log.blockNumber.toString(),
          txHash: log.transactionHash,
        });
      });

      withdrawLogs.forEach((log) => {
        if (!log.transactionHash || !log.blockNumber) return;
        const id = `${log.transactionHash}-${log.logIndex}`;
        if (existingIds.has(id)) return;
        newEvents.push({
          id,
          type: "Withdraw",
          amount: log.args.amount.toString(),
          vault,
          goalName: state.vaults[vault]?.name,
          blockNumber: log.blockNumber.toString(),
          txHash: log.transactionHash,
        });
      });
    }

    if (newEvents.length) {
      const blockNumbers = Array.from(new Set(newEvents.map((item) => item.blockNumber)));
      const blocks = await Promise.all(blockNumbers.map((bn) => client.getBlock({ blockNumber: BigInt(bn) })));
      const blockMap = new Map(blocks.map((block) => [block.number.toString(), Number(block.timestamp)]));

      newEvents.forEach((item) => {
        item.timestamp = blockMap.get(item.blockNumber);
      });

      const merged = [...newEvents, ...state.activities];
      merged.sort((a, b) => (BigInt(a.blockNumber) > BigInt(b.blockNumber) ? -1 : 1));
      state.activities = merged.slice(0, MAX_EVENTS);
    }
  }

  state.lastBlock = latestBlock.toString();
  saveState(state);
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const computeHourlyVolatilityPct = (prices) => {
  if (!Array.isArray(prices) || prices.length < 5) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = Number(prices[i - 1]?.[1] || 0);
    const curr = Number(prices[i]?.[1] || 0);
    if (prev <= 0 || curr <= 0) continue;
    returns.push(Math.log(curr / prev));
  }
  if (!returns.length) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const stdev = Math.sqrt(variance);
  return stdev * Math.sqrt(24) * 100;
};

const fetchExternalSignals = async () => {
  const errors = [];

  let fearGreed = 50;
  let fearGreedLabel = "Neutral";
  try {
    const fg = await fetchJson("https://api.alternative.me/fng/?limit=1");
    fearGreed = Number(fg?.data?.[0]?.value || 50);
    fearGreedLabel = fg?.data?.[0]?.value_classification || "Neutral";
  } catch (err) {
    errors.push(`fear_greed:${err.message}`);
  }

  let hbarPriceUsd = 0;
  let hbarChange24hPct = 0;
  try {
    const simple = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd&include_24hr_change=true"
    );
    hbarPriceUsd = Number(simple?.["hedera-hashgraph"]?.usd || 0);
    hbarChange24hPct = Number(simple?.["hedera-hashgraph"]?.usd_24h_change || 0);
  } catch (err) {
    errors.push(`coingecko_simple:${err.message}`);
  }

  let hbarVolatility24hPct = 0;
  try {
    const market = await fetchJson(
      "https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart?vs_currency=usd&days=1&interval=hourly"
    );
    hbarVolatility24hPct = computeHourlyVolatilityPct(market?.prices || []);
  } catch (err) {
    errors.push(`coingecko_vol:${err.message}`);
  }

  return {
    fearGreed,
    fearGreedLabel,
    hbarPriceUsd,
    hbarChange24hPct,
    hbarVolatility24hPct,
    errors,
    fetchedAt: nowIso(),
  };
};

const readStrategySnapshot = async (strategy) => {
  const vault = getAddress(strategy.vault);
  const depositToken = getAddress(strategy.depositToken);

  return {
    ...strategy,
    vault,
    depositToken,
  };
};

const isAddressSafe = (value) => {
  try {
    return Boolean(value && getAddress(value));
  } catch {
    return false;
  }
};

const selectStrategy = ({ signals, strategies, previousStrategyId }) => {
  const fg = clamp((signals.fearGreed - 50) / 50, -1, 1);
  const momentum = clamp(signals.hbarChange24hPct / 20, -1, 1);
  const volPenalty = clamp((signals.hbarVolatility24hPct - 6) / 12, 0, 1);

  const rawRisk = (fg + momentum) / 2;
  const normalizedRisk = clamp((rawRisk + 1) / 2 - volPenalty * 0.35, 0, 1);
  const targetRisk = normalizedRisk >= 0.55 ? "high" : "low";

  let selected =
    strategies.find((s) => s.risk === targetRisk) ||
    (targetRisk === "high"
      ? strategies.find((s) => s.risk === "medium")
      : strategies.find((s) => s.risk === "medium" || s.risk === "low")) ||
    strategies[0] ||
    null;

  const action = selected && selected.id !== previousStrategyId ? "rotate" : "hold";

  const reason = [
    `Fear&Greed=${signals.fearGreed}(${signals.fearGreedLabel})`,
    `HBAR_24h_change=${signals.hbarChange24hPct.toFixed(2)}%`,
    `HBAR_24h_vol=${signals.hbarVolatility24hPct.toFixed(2)}%`,
    `risk_score=${normalizedRisk.toFixed(3)}`,
    `target_risk=${targetRisk}`,
    selected ? `selected=${selected.id}` : "selected=none",
    `action=${action}`,
  ].join("; ");

  return { selected, action, riskScore: normalizedRisk, targetRisk, reason };
};

const resolveActualDepositToken = async (tokenAddress) => {
  const token = getAddress(tokenAddress);
  if (!wrapperAddress) return token;
  try {
    const counterpart = await client.readContract({
      address: wrapperAddress,
      abi: wrapperAbi,
      functionName: "erc20Counterpart",
      args: [token],
    });
    if (isAddressSafe(counterpart) && getAddress(counterpart) !== "0x0000000000000000000000000000000000000000") {
      return getAddress(counterpart);
    }
  } catch (err) {
    console.error("Failed to resolve ERC20 counterpart", err?.message || err);
  }
  return token;
};

const approveIfNeeded = async ({ token, owner, spender, amount }) => {
  const allowance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });

  if (allowance >= amount) return null;

  const approveHash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, (1n << 256n) - 1n],
  });

  await client.waitForTransactionReceipt({ hash: approveHash });
  return approveHash;
};

const applySlippageDown = (amount, slippageBps) => {
  if (amount <= 0n) return 0n;
  const keptBps = BigInt(10000 - slippageBps);
  return (amount * keptBps) / 10000n;
};

const executeWithdrawPhase = async ({ previousStrategy }) => {
  if (!previousStrategy || !agentAccount) return null;

  const previousVault = getAddress(previousStrategy.vault);
  const userShares = await client.readContract({
    address: previousVault,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [agentAccount.address],
  });

  if (userShares === 0n) {
    return {
      skipped: true,
      reason: "no_shares",
      strategyId: previousStrategy.id,
      vault: previousVault,
    };
  }

  const shareApprovalTxHash = await approveIfNeeded({
    token: previousVault,
    owner: agentAccount.address,
    spender: depositGuardAddress,
    amount: userShares,
  });

  const withdrawSimulation = await client.simulateContract({
    address: depositGuardAddress,
    abi: depositGuardAbi,
    functionName: "withdrawFromICHIVaultAndTryUnwrapToERC20",
    account: agentAccount.address,
    args: [previousVault, vaultDeployerAddress, userShares, agentAccount.address, 0n, 0n],
  });

  const expectedAmount0 = withdrawSimulation.result?.[0] || 0n;
  const expectedAmount1 = withdrawSimulation.result?.[1] || 0n;
  const minAmount0 = applySlippageDown(expectedAmount0, AGENT_SLIPPAGE_BPS);
  const minAmount1 = applySlippageDown(expectedAmount1, AGENT_SLIPPAGE_BPS);

  const withdrawTxHash = await walletClient.writeContract({
    address: depositGuardAddress,
    abi: depositGuardAbi,
    functionName: "withdrawFromICHIVaultAndTryUnwrapToERC20",
    args: [previousVault, vaultDeployerAddress, userShares, agentAccount.address, minAmount0, minAmount1],
  });

  await client.waitForTransactionReceipt({ hash: withdrawTxHash });

  return {
    skipped: false,
    strategyId: previousStrategy.id,
    vault: previousVault,
    shares: userShares.toString(),
    expectedAmount0: expectedAmount0.toString(),
    expectedAmount1: expectedAmount1.toString(),
    minAmount0: minAmount0.toString(),
    minAmount1: minAmount1.toString(),
    shareApprovalTxHash,
    withdrawTxHash,
  };
};

const executeDepositPhase = async ({ selectedStrategy, amountOverride }) => {
  const selectedVault = getAddress(selectedStrategy.vault);
  const rawDepositToken = getAddress(selectedStrategy.depositToken);
  const actualDepositToken = await resolveActualDepositToken(rawDepositToken);

  const decimals = Number(
    await client.readContract({ address: actualDepositToken, abi: erc20Abi, functionName: "decimals" })
  );

  const desiredAmount = amountOverride ?? parseUnits(AGENT_DEPOSIT_AMOUNT, decimals);
  if (desiredAmount <= 0n) {
    throw new Error("Deposit amount resolved to zero");
  }

  const balance = await client.readContract({
    address: actualDepositToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [agentAccount.address],
  });

  if (balance < desiredAmount) {
    throw new Error(
      `Insufficient balance. token=${actualDepositToken} have=${balance.toString()} need=${desiredAmount.toString()}`
    );
  }

  const approvalTxHash = await approveIfNeeded({
    token: actualDepositToken,
    owner: agentAccount.address,
    spender: depositGuardAddress,
    amount: desiredAmount,
  });

  const depositSimulation = await client.simulateContract({
    address: depositGuardAddress,
    abi: depositGuardAbi,
    functionName: "depositToICHIVaultAndTryWrapToHTS",
    account: agentAccount.address,
    args: [selectedVault, vaultDeployerAddress, actualDepositToken, desiredAmount, 0n, agentAccount.address],
  });

  const expectedVaultTokens = depositSimulation.result || 0n;
  const minimumProceeds = applySlippageDown(expectedVaultTokens, AGENT_SLIPPAGE_BPS);

  const depositTxHash = await walletClient.writeContract({
    address: depositGuardAddress,
    abi: depositGuardAbi,
    functionName: "depositToICHIVaultAndTryWrapToHTS",
    args: [
      selectedVault,
      vaultDeployerAddress,
      actualDepositToken,
      desiredAmount,
      minimumProceeds,
      agentAccount.address,
    ],
  });

  await client.waitForTransactionReceipt({ hash: depositTxHash });

  return {
    strategyId: selectedStrategy.id,
    vault: selectedVault,
    amount: desiredAmount.toString(),
    token: actualDepositToken,
    minimumProceeds: minimumProceeds.toString(),
    expectedVaultTokens: expectedVaultTokens.toString(),
    approvalTxHash,
    depositTxHash,
  };
};

const executeDecision = async (decision, previousStrategy) => {
  if (!walletClient || !agentAccount) {
    throw new Error("Agent wallet not configured");
  }
  if (!depositGuardAddress || !vaultDeployerAddress) {
    throw new Error("Missing agent deposit guard/deployer config");
  }
  if (!decision?.selectedStrategy) {
    throw new Error("No selected strategy");
  }

  const selected = decision.selectedStrategy;
  const selectedToken = getAddress(selected.depositToken);
  const selectedActualToken = await resolveActualDepositToken(selectedToken);

  let withdraw = null;
  let amountOverride = null;

  const canRebalance =
    previousStrategy &&
    previousStrategy.id !== selected.id &&
    previousStrategy.depositToken &&
    isAddressSafe(previousStrategy.depositToken);

  if (canRebalance) {
    const previousToken = getAddress(previousStrategy.depositToken);
    const previousActualToken = await resolveActualDepositToken(previousToken);

    if (previousActualToken.toLowerCase() !== selectedActualToken.toLowerCase()) {
      throw new Error(
        `Cannot rebalance across incompatible deposit tokens: ${previousActualToken} -> ${selectedActualToken}`
      );
    }

    withdraw = await executeWithdrawPhase({ previousStrategy });

    amountOverride = await client.readContract({
      address: selectedActualToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [agentAccount.address],
    });

    if (amountOverride <= 0n) {
      throw new Error(`No ${selectedActualToken} balance available after withdraw`);
    }
  }

  const deposit = await executeDepositPhase({ selectedStrategy: selected, amountOverride });

  return {
    strategyId: selected.id,
    selectedVault: deposit.vault,
    token: deposit.token,
    depositAmount: deposit.amount,
    slippageBps: AGENT_SLIPPAGE_BPS,
    withdraw,
    deposit,
    executedAt: nowIso(),
  };
};

const fetchHakBonzoMarketData = async () => {
  const { toolNames, network } = buildHakAgentApi({ requireSigner: false });
  const marketData = await runHakTool({
    toolName: toolNames.BONZO_MARKET_DATA_TOOL,
    params: {},
    requireSigner: false,
  });
  return {
    network,
    tool: toolNames.BONZO_MARKET_DATA_TOOL,
    marketData,
    fetchedAt: nowIso(),
  };
};

const executeDecisionWithHak = async (decision, previousStrategy) => {
  if (!decision?.selectedStrategy) {
    throw new Error("No selected strategy");
  }

  const { toolNames, network } = buildHakAgentApi({ requireSigner: true });
  const tokenSymbol = AGENT_HAK_TOKEN_SYMBOL;
  const amount = String(AGENT_DEPOSIT_AMOUNT);

  let withdraw = null;
  if (previousStrategy && previousStrategy.id !== decision.selectedStrategy.id) {
    try {
      withdraw = await runHakTool({
        toolName: toolNames.BONZO_WITHDRAW_TOOL,
        params: {
          required: { tokenSymbol, amount },
          optional: { withdrawAll: true },
        },
        requireSigner: true,
      });
    } catch (err) {
      withdraw = { error: err?.message || String(err) };
    }
  }

  const approval = await runHakTool({
    toolName: toolNames.APPROVE_ERC20_TOOL,
    params: {
      required: { tokenSymbol, amount },
      optional: { useMax: true },
    },
    requireSigner: true,
  });

  const deposit = await runHakTool({
    toolName: toolNames.BONZO_DEPOSIT_TOOL,
    params: {
      required: { tokenSymbol, amount },
      optional: {},
    },
    requireSigner: true,
  });

  return {
    executor: "hak",
    network,
    tokenSymbol,
    amount,
    strategyId: decision.selectedStrategy.id,
    selectedStrategyId: decision.selectedStrategy.id,
    selectedVault: decision.selectedStrategy.vault,
    withdraw,
    approval,
    deposit,
    executedAt: nowIso(),
  };
};

const buildDecision = async () => {
  const strategies = await Promise.all(AGENT_STRATEGIES.map((s) => readStrategySnapshot(s)));
  const signals = await fetchExternalSignals();
  const selection = selectStrategy({
    signals,
    strategies,
    previousStrategyId: state.agent.lastExecutedStrategyId,
  });

  return {
    at: nowIso(),
    autoExecuteEnabled: AGENT_AUTO_EXECUTE,
    walletConfigured: Boolean(walletClient && agentAccount),
    signals,
    riskScore: selection.riskScore,
    targetRisk: selection.targetRisk,
    action: selection.action,
    reason: selection.reason,
    selectedStrategy: selection.selected,
    strategyCatalog: strategies,
  };
};

const runAgentCycle = async ({ autoExecute = false, manual = false, executor = AGENT_EXECUTOR } = {}) => {
  if (!AGENT_ENABLED && !manual) {
    return { skipped: true, reason: "agent_disabled" };
  }

  if (agentRunning) {
    return { skipped: true, reason: "agent_busy" };
  }

  agentRunning = true;
  try {
    const decision = await buildDecision();
    state.agent.lastRunAt = decision.at;
    state.agent.lastDecision = decision;

    const preExecutionStrategyId = state.agent.lastExecutedStrategyId || null;
    const activeExecutor = (executor || AGENT_EXECUTOR || "viem").toLowerCase();
    let execution = null;
    if (autoExecute || manual) {
      const lastExecutedAt = state.agent.lastExecution?.executedAt
        ? new Date(state.agent.lastExecution.executedAt).getTime()
        : 0;
      const withinCooldown = Date.now() - lastExecutedAt < AGENT_MIN_REBALANCE_MS;
      const strategyChanged = decision.selectedStrategy?.id !== state.agent.lastExecutedStrategyId;
      const previousStrategy = AGENT_STRATEGIES.find((s) => s.id === preExecutionStrategyId) || null;

      if (manual || (decision.action === "rotate" && strategyChanged && !withinCooldown)) {
        execution =
          activeExecutor === "hak"
            ? await executeDecisionWithHak(decision, previousStrategy)
            : await executeDecision(decision, previousStrategy);
        state.agent.lastExecution = execution;
        state.agent.lastExecutedStrategyId = execution.strategyId;
      }
    }

    const historyItem = {
      at: nowIso(),
      action: decision.action,
      strategyId: decision.selectedStrategy?.id || null,
      previousStrategyId: preExecutionStrategyId,
      executor: activeExecutor,
      riskScore: decision.riskScore,
      autoExecuteAttempted: Boolean(autoExecute || manual),
      executed: Boolean(execution),
      execution,
      reason: decision.reason,
      signalErrors: decision.signals.errors,
    };

    pushAgentHistory(historyItem);
    saveState(state);

    return { decision, execution, historyItem };
  } catch (err) {
    const failure = {
      at: nowIso(),
      executed: false,
      error: err?.message || String(err),
    };
    pushAgentHistory(failure);
    saveState(state);
    return { error: failure.error };
  } finally {
    agentRunning = false;
  }
};

const startPolling = () => {
  if (factoryAddress) {
    const runIndexerTick = () => {
      indexOnce().catch((err) => console.error("Indexer error", err));
    };
    runIndexerTick();
    setInterval(runIndexerTick, POLL_INTERVAL_MS);
  }

  if (AGENT_ENABLED) {
    const runAgentTick = () => {
      runAgentCycle({ autoExecute: AGENT_AUTO_EXECUTE }).catch((err) =>
        console.error("Agent cycle error", err)
      );
    };
    runAgentTick();
    setInterval(runAgentTick, AGENT_INTERVAL_MS);
  }
};

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  const allowedHeaders = Array.from(
    new Set(["Content-Type", "x-agent-api-key", AGENT_EXECUTE_HEADER].filter(Boolean))
  ).join(",");
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/status", (req, res) => {
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    lastBlock: state.lastBlock,
    factoryConfigured: Boolean(factoryAddress),
    vaults: Object.keys(state.vaults).length,
    activities: state.activities.length,
    agent: {
      enabled: AGENT_ENABLED,
      autoExecute: AGENT_AUTO_EXECUTE,
      executor: AGENT_EXECUTOR,
      slippageBps: AGENT_SLIPPAGE_BPS,
      walletConfigured: Boolean(walletClient && agentAccount),
      hakAvailable: Boolean(hakRuntime),
      hakAccountConfigured: Boolean(AGENT_ACCOUNT_ID && AGENT_PRIVATE_KEY),
      lastRunAt: state.agent.lastRunAt,
      lastExecutedStrategyId: state.agent.lastExecutedStrategyId,
      historyItems: state.agent.history.length,
    },
  });
});

app.get("/activity", (req, res) => {
  const limit = parsePositiveInt(req.query.limit || 8, 8, MAX_EVENTS);
  const vaultsParam = (req.query.vaults || "").toString();
  let vaultSet = new Set();
  try {
    vaultSet = new Set(
      vaultsParam
        .split(",")
        .map((vault) => vault.trim())
        .filter((vault) => vault)
        .map((vault) => normalizeVault(vault))
    );
  } catch {
    return res.status(400).json({ error: "Invalid vault address in query parameter 'vaults'" });
  }

  let items = state.activities;
  if (vaultSet.size > 0) {
    items = items.filter((item) => vaultSet.has(normalizeVault(item.vault)));
  }

  res.json({ activities: items.slice(0, limit) });
});

app.get("/agent/status", (req, res) => {
  res.json({
    enabled: AGENT_ENABLED,
    autoExecute: AGENT_AUTO_EXECUTE,
    walletConfigured: Boolean(walletClient && agentAccount),
    account: agentAccount?.address || null,
    depositGuardAddress,
    vaultDeployerAddress,
    wrapperAddress,
    depositAmount: AGENT_DEPOSIT_AMOUNT,
    slippageBps: AGENT_SLIPPAGE_BPS,
    executor: AGENT_EXECUTOR,
    hakAvailable: Boolean(hakRuntime),
    hakInitError: hakInitError?.message || null,
    hakAccountId: AGENT_ACCOUNT_ID || null,
    hakTokenSymbol: AGENT_HAK_TOKEN_SYMBOL,
    hakNetwork: getHakNetwork(),
    executeAuthRequired: requiresExecuteAuth,
    executeAuthHeader: AGENT_EXECUTE_HEADER,
    intervalMs: AGENT_INTERVAL_MS,
    minRebalanceMs: AGENT_MIN_REBALANCE_MS,
    strategies: AGENT_STRATEGIES,
    lastRunAt: state.agent.lastRunAt,
    lastDecision: state.agent.lastDecision,
    lastExecution: state.agent.lastExecution,
    history: state.agent.history.slice(0, 30),
  });
});

app.get("/agent/decision", async (req, res) => {
  try {
    const decision = await buildDecision();
    state.agent.lastDecision = decision;
    state.agent.lastRunAt = decision.at;
    saveState(state);
    res.json({ decision });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get("/agent/hak/market", async (req, res) => {
  try {
    const market = await fetchHakBonzoMarketData();
    return res.json(market);
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

app.post("/agent/execute", async (req, res) => {
  if (!isExecuteAuthorized(req)) {
    return res.status(401).json({ error: `Unauthorized: include ${AGENT_EXECUTE_HEADER} header` });
  }

  const manual = req.body?.manual !== false;
  const requestedExecutor = String(req.body?.executor || AGENT_EXECUTOR || "viem").toLowerCase();
  if (requestedExecutor !== "viem" && requestedExecutor !== "hak") {
    return res.status(400).json({ error: "Invalid executor. Use 'viem' or 'hak'." });
  }

  const result = await runAgentCycle({ manual, autoExecute: false, executor: requestedExecutor });
  if (result?.error) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

app.get("/health", (req, res) => {
  const healthy = Boolean(RPC_URL);
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    uptimeSeconds: Math.floor(process.uptime()),
    rpcConfigured: Boolean(RPC_URL),
    factoryConfigured: Boolean(factoryAddress),
    agentEnabled: AGENT_ENABLED,
  });
});

app.listen(PORT, () => {
  console.log(`Indexer listening on ${PORT}`);
  initializeStateMeta()
    .then(() => startPolling())
    .catch((err) => {
      console.error("Failed to initialize state metadata", err);
      process.exit(1);
    });
});
