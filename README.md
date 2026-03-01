# Fundory (MVP)

Minimal contracts + app for a goal-based savings vault with on-chain deposits.

## Structure

- `contracts/` Hardhat contracts + scripts
- `app/` Next.js app (landing + dashboard)
- `indexer/` Activity indexer API

## Contracts

The vault is one-per-goal:

- `GoalVaultFactory` creates a vault with goal metadata
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
npm run deploy:testnet
```

Optional env vars:
- `USDC_ADDRESS` to skip mock deployment
- `MINT_TO` and `MINT_AMOUNT` to mint mock USDC
- `STRATEGY_APR_BPS_A` and `STRATEGY_APR_BPS_B` to change strategy APRs

### Mantle deploy commands

Mainnet:
```bash
cd contracts
export PRIVATE_KEY=YOUR_DEPLOYER_KEY
npm run deploy:mainnet
```

Mantle testnet (Sepolia, chainId 5003):
```bash
cd contracts
export PRIVATE_KEY=YOUR_DEPLOYER_KEY
npm run deploy:testnet
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

## Demo flow (quick)

1. Deploy `MockUSDC` + `GoalVaultFactory`.
2. Deploy the two mock strategies and add their addresses to `app/.env`.
3. Create a goal and select the strategy (APR) to use.
4. Approve USDC for the vault (one-time).
5. Deposit on-chain from the app.
6. Wait for yield to accrue on-chain based on the strategy APR.
