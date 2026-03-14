# Fundory Submission Answers (Copy/Paste)

## 1) Bonzo Bounty Form

### Which bounty are you submitting for?
Bonzo Finance bounty (Hedera).

### Problem Statement Details
Fundory is a goal-based savings app where each goal creates its own on-chain vault on Hedera. Users choose a goal mode persisted on-chain: Max Yield (auto-optimized), Prized Yield (principal-safe prize flow), or Select a Strategy (manual lock).

It uses Bonzo routes for live yield strategies and supports autonomous or semi-autonomous execution through an agent service, with an optional Hedera Agent Kit executor path (`AGENT_EXECUTOR=hak`) for Bonzo plugin-based actions.

Why it matters: users get transparent, non-custodial savings with programmable risk per goal, on-chain proof of deposits/withdrawals, and automation controls.

Demo setup: connect wallet, create goal on `/app/goals`, approve + deposit, then use `/app/automation` to run manual agent execution and inspect transactions.

### Solution Demo Link
`<PASTE_DEPLOYED_APP_URL>`

### Github Repository Link (with commits made during the hackathon)
`<PASTE_PUBLIC_REPO_LATEST_COMMIT_URL>`

### User Experience Feedback
Hedera EVM made contract and frontend iteration fast with familiar tooling. Bonzo integration gave practical, strategy-driven DeFi routes. Main friction was cross-service environment alignment (contracts/app/indexer/agent), especially executor mode and auth setup, but once aligned the stack was reliable. Hedera Agent Kit support improved autonomous workflow alignment for bounty judging.

### Provide proof of an on-chain transaction by indicating one Hedera testnet on-chain account
Hedera testnet account: `<PASTE_HEDERA_TESTNET_ACCOUNT_ID>`
Example tx hash: `<PASTE_TX_HASH>`

### What is your Discord handle?
`<PASTE_DISCORD_HANDLE>`

### LinkedIn profile
`<PASTE_LINKEDIN_URL>`

---

## 2) Hedera Track Form (Theme 1: AI & Agents)

### Challenge Theme
Theme 1: AI & Agents

### Project Name
Fundory

### Project Description
Fundory is a goal-based savings protocol on Hedera where each goal maps to an on-chain vault and stores a mode on-chain: Max Yield, Prized Yield, or Select a Strategy. An agent consumes external market signals and strategy metadata to decide risk-aware rotations, with manual and auto execution controls. Users verify deposits, withdrawals, and goal progress on-chain.

Tech stack: Solidity/Hardhat, Next.js/TypeScript, Wagmi + Viem, Hedera JSON-RPC, Hedera Agent Kit, Bonzo plugin integration, Express indexer/agent.

Local setup is documented in the repository README.

### Project's GitHub Repo Link (with commits made during the hackathon)
`<PASTE_PUBLIC_REPO_LATEST_COMMIT_URL>`

### Pitch Deck (in PDF)
Upload: `submission/pitch-deck.pdf`

### Project Demo Video Link
Upload `submission/fundory-demo.webm` to YouTube/Drive and paste public URL:
`<PASTE_VIDEO_URL>`

### Project Demo Link
`<PASTE_DEPLOYED_APP_URL>`

### Form Ratings (Suggested)
- Confidence after docs: `8`
- Ease of getting help when blocked: `7`
- API/SDK intuitiveness: `8`
- Ease of debugging: `7`
- Likelihood to build again on Hedera: `9`

### What are your main goals/objectives for participating?
Build a production-like autonomous DeFi savings product, validate Hedera for agentic financial workflows, and deliver a transparent UX where AI decisions can be executed and audited on-chain.

### Biggest friction/blocker
Keeping contracts, app, indexer, and agent executor settings synchronized across local/testnet/mainnet environments.

### One improvement suggestion
Provide a canonical full-stack starter template (contracts + frontend + indexer + agent) with automatic environment validation and deployment verification.

### What worked especially well?
Fast finality, predictable low fees, strong EVM compatibility, and smooth composition of Hedera Agent Kit with DeFi integrations.

### Hedera Testnet Account ID of the team
`<PASTE_ONE_TESTNET_ACCOUNT_ID>`

### Mainnet wallet addresses of all members
`<PASTE_COMMA_SEPARATED_MAINNET_WALLETS>`

### Discord Handles of all members
`<PASTE_COMMA_SEPARATED_DISCORD_HANDLES>`

### LinkedIn Profile URLs of all members
`<PASTE_COMMA_SEPARATED_LINKEDIN_URLS>`

### Final thoughts on building on Hedera
Hedera is strong for agentic systems with frequent state updates because fees are low and predictable. EVM compatibility reduced development friction, and Agent Kit made autonomous actions practical. The main pain point is operational complexity across multi-service setups; better standard templates and env validation would significantly reduce onboarding and debugging time.
