const fs = require("fs");
const path = require("path");
const express = require("express");
const { createPublicClient, http, parseAbiItem, getAddress } = require("viem");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const START_BLOCK = BigInt(process.env.START_BLOCK || 0);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 12000);
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 1000);
const PORT = Number(process.env.PORT || 8081);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

if (!RPC_URL || !FACTORY_ADDRESS) {
  throw new Error("Missing RPC_URL or FACTORY_ADDRESS");
}

const statePath = path.join(__dirname, "state.json");

const defaultState = {
  lastBlock: "0",
  vaults: {},
  activities: [],
};

const loadState = () => {
  if (!fs.existsSync(statePath)) return { ...defaultState };
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch (err) {
    console.error("Failed to read state file", err);
    return { ...defaultState };
  }
};

const saveState = (state) => {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
};

const state = loadState();

const client = createPublicClient({ transport: http(RPC_URL) });
const factoryAddress = getAddress(FACTORY_ADDRESS);

const goalCreatedEvent = parseAbiItem(
  "event GoalCreated(uint256 indexed goalId,address indexed owner,address vault,string name,uint256 targetAmount,address strategy)"
);
const depositEvent = parseAbiItem(
  "event Deposited(address indexed from,address indexed beneficiary,uint256 amount,uint256 sharesMinted)"
);
const withdrawEvent = parseAbiItem(
  "event Withdrawn(address indexed to,uint256 amount,uint256 sharesBurned)"
);

const normalizeVault = (vault) => getAddress(vault);

const indexOnce = async () => {
  const latestBlock = await client.getBlockNumber();
  const lastBlock = state.lastBlock ? BigInt(state.lastBlock) : 0n;
  const fromBlock = lastBlock > 0n ? lastBlock + 1n : START_BLOCK;

  if (fromBlock > latestBlock) return;

  const goalLogs = await client.getLogs({
    address: factoryAddress,
    event: goalCreatedEvent,
    fromBlock,
    toBlock: latestBlock,
  });

  goalLogs.forEach((log) => {
    const vault = normalizeVault(log.args.vault);
    state.vaults[vault] = {
      goalId: log.args.goalId.toString(),
      owner: log.args.owner,
      name: log.args.name,
      targetAmount: log.args.targetAmount.toString(),
      strategy: log.args.strategy,
    };
  });

  const vaultAddresses = Object.keys(state.vaults);
  if (vaultAddresses.length) {
    const newEvents = [];
    const existingIds = new Set(state.activities.map((item) => item.id));

    for (const vault of vaultAddresses) {
      const [depositLogs, withdrawLogs] = await Promise.all([
        client.getLogs({
          address: vault,
          event: depositEvent,
          fromBlock,
          toBlock: latestBlock,
        }),
        client.getLogs({
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
      const blocks = await Promise.all(
        blockNumbers.map((bn) => client.getBlock({ blockNumber: BigInt(bn) }))
      );
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

const startPolling = async () => {
  await indexOnce();
  setInterval(() => {
    indexOnce().catch((err) => console.error("Indexer error", err));
  }, POLL_INTERVAL_MS);
};

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/status", (req, res) => {
  res.json({
    lastBlock: state.lastBlock,
    vaults: Object.keys(state.vaults).length,
    activities: state.activities.length,
  });
});

app.get("/activity", (req, res) => {
  const limit = Number(req.query.limit || 8);
  const vaultsParam = (req.query.vaults || "").toString();
  const vaultSet = new Set(
    vaultsParam
      .split(",")
      .map((vault) => vault.trim())
      .filter((vault) => vault)
      .map((vault) => normalizeVault(vault))
  );

  let items = state.activities;
  if (vaultSet.size > 0) {
    items = items.filter((item) => vaultSet.has(normalizeVault(item.vault)));
  }

  res.json({ activities: items.slice(0, limit) });
});

app.listen(PORT, () => {
  console.log(`Indexer listening on ${PORT}`);
  startPolling().catch((err) => console.error(err));
});
