# Fundory (Hedera MVP)

Minimal contracts + app for a goal-based savings vault with on-chain deposits.

## Structure

- `contracts/` Hardhat contracts + scripts
- `app/` Next.js app (landing + dashboard)
- `indexer/` Activity indexer API

## Contracts

The vault is one-per-goal:

- `GoalVaultFactory` creates a vault with goal metadata
- Goal mode is persisted on-chain (`Max Yield`, `Prized Yield`, `Select a Strategy`)
- `GoalVault` accepts deposits and tracks shares
- `MockUSDC` for local testing (6 decimals)
- `MockYieldStrategy` simulates fixed APR yield on-chain

### Local setup (Hardhat)

```bash
cd contracts
cp .env.example .env
npm install
npm run compile
```

Notes:
- Deploy `MockUSDC` and mint to your wallet for local tests.
- Deploy two mock strategies with different APRs (defaults are 5% and 10%).
- `MockYieldStrategy` requires a mintable asset (use MockUSDC on testnet).

### Deploy script (Hardhat)

```bash
cd contracts
npm run deploy:hedera:testnet
```

Deploy only two yield strategies (stable + growth) for an existing token:
```bash
cd contracts
USDC_ADDRESS=<token_address> npm run deploy:strategies:hedera:testnet
```

Optional env vars:
- `USDC_ADDRESS` to skip mock deployment
- `MINT_TO` and `MINT_AMOUNT` to mint mock USDC
- `STRATEGY_APR_BPS_A` and `STRATEGY_APR_BPS_B` to change strategy APRs

Hedera mainnet:
```bash
cd contracts
export PRIVATE_KEY=YOUR_DEPLOYER_KEY
npm run deploy:hedera
```

### Foundry (optional)

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
```

## Frontend (Next.js app)

```bash
cd app
cp .env.example .env
npm install
npm run dev
```

Recommended runtime for demos/judging capture: production mode (`npm run build && npm run start`).

Set in `.env`:
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_STRATEGY_STABLE_ADDRESS`
- `NEXT_PUBLIC_STRATEGY_GROWTH_ADDRESS`
- `NEXT_PUBLIC_STRATEGY_STABLE_NAME` (optional)
- `NEXT_PUBLIC_STRATEGY_GROWTH_NAME` (optional)
- `NEXT_PUBLIC_STRATEGY_STABLE_APR_BPS` (optional)
- `NEXT_PUBLIC_STRATEGY_GROWTH_APR_BPS` (optional)
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_INDEXER_URL`
- `NEXT_PUBLIC_CHAIN_NAME` (optional)
- `NEXT_PUBLIC_EXPLORER_URL` (optional)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional, enables WalletConnect)
- `NEXT_PUBLIC_AGENT_URL` (indexer/agent base URL, usually `http://localhost:8081`)
- `NEXT_PUBLIC_AGENT_EXECUTOR` (optional, `hak` or `viem` for manual execute requests)
- `NEXT_PUBLIC_AGENT_EXECUTE_HEADER` (optional, defaults to `x-agent-api-key`)
- `NEXT_PUBLIC_AGENT_EXECUTE_API_KEY` (optional key for protected `/agent/execute`)
- `NEXT_PUBLIC_BONZO_VAULT_ADDRESS` (Bonzo vault LP token address)
- `NEXT_PUBLIC_BONZO_DEPOSIT_GUARD_ADDRESS` (Bonzo DepositGuard on Hedera)
- `NEXT_PUBLIC_BONZO_VAULT_DEPLOYER_ADDRESS` (Bonzo vault deployer / gnosis)
- `NEXT_PUBLIC_HEDERA_ERC20_WRAPPER_ADDRESS` (Hedera ERC20 wrapper contract)
- `NEXT_PUBLIC_PRIZE_POOL_ADDRESS` (Prize savings pool contract)

Bonzo defaults are pre-filled in `app/.env.example` for Hedera mainnet.

## Indexer

```bash
cd indexer
cp .env.example .env
npm install
npm run start
```

Set in `indexer/.env`:
- `RPC_URL`
- `FACTORY_ADDRESS`
- `START_BLOCK` (optional)
- `CORS_ORIGIN` (optional)
- `AGENT_ENABLED` (`true`/`false`)
- `AGENT_AUTO_EXECUTE` (`true` enables unattended execution)
- `AGENT_INTERVAL_MS` (agent cycle interval)
- `AGENT_EXECUTOR` (`viem` for vault-guard flow, `hak` for Hedera Agent Kit + Bonzo plugin flow)
- `AGENT_ACCOUNT_ID` (required for `AGENT_EXECUTOR=hak` autonomous transactions)
- `AGENT_PRIVATE_KEY` (wallet used for autonomous execution)
- `AGENT_DEPOSIT_AMOUNT` (amount per execution cycle)
- `AGENT_HAK_TOKEN_SYMBOL` (Bonzo token symbol for HAK mode, e.g. `USDC`)
- `AGENT_SLIPPAGE_BPS` (slippage bounds used for withdraw mins and deposit minimumProceeds)
- `AGENT_EXECUTE_HEADER` (optional auth header name for `/agent/execute`, default `x-agent-api-key`)
- `AGENT_EXECUTE_API_KEY` (optional API key to protect `/agent/execute`)
- `AGENT_DEPOSIT_GUARD_ADDRESS` (Bonzo deposit guard)
- `AGENT_VAULT_DEPLOYER_ADDRESS` (Bonzo vault deployer)
- `HEDERA_ERC20_WRAPPER_ADDRESS` (Hedera ERC20 wrapper)
- `AGENT_STRATEGIES_JSON` (optional custom strategy list)

## Demo flow (quick)

1. Deploy `MockUSDC` + `GoalVaultFactory` (latest contract version with `mode` support).
2. Deploy the two mock strategies and add their addresses to `app/.env`.
3. Create a goal and select mode + strategy route.
4. Approve USDC for the vault (one-time).
5. Deposit on-chain from the app.
6. Wait for yield to accrue on-chain based on the strategy APR.

## App pages

- `/app` Portfolio overview
- `/app/goals` Goal list + mode-specific goal detail views
- `/app/automation` Agent status, controls, recent runs, quick protocol actions
- `/app/settings` Wallet & Network, Safety Defaults, Notifications, Data & Permissions

## Prize savings account

Fundory includes a `PrizeSavingsPool` contract (`contracts/src/PrizeSavingsPool.sol`) for:
1. Principal-protected savings deposits.
2. Prize pot sponsorship.
3. Weighted winner draws based on user savings balances.

Deploy command (Hedera):
```bash
cd contracts
USDC_ADDRESS=<token_address> npm run deploy:prizepool:hedera
```

## Agentic strategy logic

The `indexer` service now includes an autonomous strategy agent with:
1. External signals: Fear & Greed + HBAR market change + volatility.
2. Real strategy catalog: live Bonzo Hedera strategies (DEX LP and staking-linked).
3. Decision policy: dynamic risk score and strategy rotation (not fixed schedules).
4. Rebalance executor: withdraws old strategy shares then deposits into the new strategy.
5. Slippage protection: applies bounds to withdraw mins and deposit minimum proceeds.
6. Hedera Agent Kit mode: optional execution via `hedera-agent-kit` + `@bonzofinancelabs/hak-bonzo-plugin`.
7. Semi-auto execution: manual trigger via app **Automation > Run now**.
8. Auto execution: periodic unattended execution when `AGENT_AUTO_EXECUTE=true`.

Rebalance guardrail:
- The agent only rotates between strategies with compatible deposit tokens. If tokens are incompatible, it skips execution with an explicit error.

Key endpoints:
- `GET /health`
- `GET /agent/status`
- `GET /agent/decision`
- `GET /agent/hak/market`
- `POST /agent/execute`

If `AGENT_EXECUTE_API_KEY` is set, `POST /agent/execute` requires the configured auth header.

To run the Bonzo path through Hedera Agent Kit for bounty compliance:
- set `AGENT_EXECUTOR=hak`
- set `AGENT_ACCOUNT_ID` and `AGENT_PRIVATE_KEY`
- optionally set `NEXT_PUBLIC_AGENT_EXECUTOR=hak` in the app

## Local end-to-end smoke test (verified)

1. Start local chain:
```bash
cd contracts
npx hardhat node
```

2. Deploy contracts to localhost:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

3. Run contract smoke flow (create goal with on-chain mode + deposit):
```bash
cd contracts
FACTORY_ADDRESS=<factory> USDC_ADDRESS=<usdc> STRATEGY_ADDRESS=<stable_strategy> npm run smoke:local
```

4. Start indexer against localhost:
```bash
cd indexer
RPC_URL=http://127.0.0.1:8545 FACTORY_ADDRESS=<factory> AGENT_ENABLED=false npm run start
```

Backend smoke checks (in a second terminal):
```bash
cd indexer
INDEXER_BASE_URL=http://127.0.0.1:8081 npm run smoke
```

5. Start app against localhost:
```bash
cd app
NEXT_PUBLIC_FACTORY_ADDRESS=<factory> \
NEXT_PUBLIC_USDC_ADDRESS=<usdc> \
NEXT_PUBLIC_STRATEGY_STABLE_ADDRESS=<stable_strategy> \
NEXT_PUBLIC_STRATEGY_GROWTH_ADDRESS=<growth_strategy> \
NEXT_PUBLIC_CHAIN_ID=31337 \
NEXT_PUBLIC_CHAIN_NAME="Hardhat Local" \
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 \
NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8081 \
NEXT_PUBLIC_AGENT_URL=http://127.0.0.1:8081 \
npm run dev
```

6. Optional demo capture:
```bash
cd app
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:record
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:responsive
```

Generated demo artifacts:
- `submission/fundory-demo.webm`
- `app/demo-artifacts/final-settings.png`
- `submission/responsive-check/goals-desktop.png`
- `submission/responsive-check/goals-mobile.png`
