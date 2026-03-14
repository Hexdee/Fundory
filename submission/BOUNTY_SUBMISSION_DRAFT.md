# Bounty Submission Draft (Bonzo)

## Which bounty are you submitting for?
Bonzo Finance bounty (Hedera).

## Problem Statement Details

### Your solution
Fundory is a goal-based savings app on Hedera where each goal creates a dedicated on-chain vault. Users choose one of three on-chain persisted goal modes: Max Yield (auto-optimized), Prized Yield (principal-safe prize-oriented), or Select a Strategy (manual lock). The app includes autonomous/semi-autonomous strategy execution, live automation controls, and transparent activity tracking.

### How it uses the partner’s API / protocol / tool
- Bonzo: strategy catalog and Bonzo-compatible yield routes.
- Hedera Agent Kit: optional autonomous executor path (`AGENT_EXECUTOR=hak`) with Bonzo plugin support.
- Hedera EVM: goal factory/vault interactions, deposits, withdrawals, strategy-mode metadata, and transaction proofs.

### Why it matters
Most savings apps are either opaque or centralized. Fundory gives users transparent, programmable, and autonomous savings accounts where strategy risk can be selected per goal, all verifiable on Hedera.

### Setup instructions for demo access
1. Open the live demo URL.
2. Connect wallet (HashPack/WalletConnect).
3. Open `/app/goals` and create a goal with any mode.
4. Approve token and deposit.
5. Open `/app/automation` and click **Run now** to trigger decision/execution.
6. Inspect transactions via HashScan links.

## Solution Demo Link
`<PASTE_DEPLOYED_APP_URL>`

## GitHub Repository Link
`<PASTE_PUBLIC_REPO_LATEST_COMMIT_URL>`

## User Experience Feedback
Building with Hedera EVM RPC and Bonzo integrations was fast once contract addresses and network config were aligned. Biggest friction was cross-tool setup consistency (RPC, agent executor mode, and auth headers) across app/indexer/contracts. Hedera Agent Kit support improved the autonomous path and bounty alignment.

## Proof of On-Chain Transaction (Hedera testnet account)
Account ID: `<PASTE_HEDERA_TESTNET_ACCOUNT_ID>`

## Discord handle
`<PASTE_DISCORD_HANDLE>`

## LinkedIn
`<PASTE_LINKEDIN_URL>`

