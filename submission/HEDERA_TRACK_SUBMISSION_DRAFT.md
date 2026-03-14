# Hedera Track Submission Draft (Theme 1: AI & Agents)

## Challenge Theme
Theme 1: AI & Agents

## Project Name
Fundory

## Project Description (paste-ready)
Fundory is a goal-based savings protocol on Hedera with autonomous and user-controlled yield accounts. Every goal creates an on-chain vault and stores a mode on-chain: Max Yield (auto strategy rotation), Prized Yield (principal-safe prize route), or Select a Strategy (manual lock). An agent consumes live external signals and strategy data to decide rotations, with manual/auto execution controls in-app. Users can verify all deposits, withdrawals, and activity on-chain.

Tech stack: Solidity (Hardhat), Next.js/TypeScript, Wagmi + Viem, Hedera JSON-RPC, Hedera Agent Kit, Bonzo plugin integration, Express indexer/agent service.

Local setup: run contracts, indexer, and app as documented in README.

## Project GitHub Repo Link
`<PASTE_PUBLIC_REPO_LATEST_COMMIT_URL>`

## Pitch Deck (PDF)
Use: `submission/pitch-deck.pdf`

## Project Demo Video Link
Upload `submission/fundory-demo.webm` to YouTube/Drive and paste public URL:
`<PASTE_VIDEO_URL>`

## Project Demo Link
`<PASTE_DEPLOYED_APP_URL>`

## Form Ratings (suggested)
- Confidence after docs: `8`
- Ease of getting help: `7`
- API/SDK intuitiveness: `8`
- Ease of debugging: `7`
- Likelihood to build again on Hedera: `9`

## Main goals/objectives for participating
Build a production-like autonomous DeFi savings product, validate Hedera for agentic finance use cases, and ship a transparent user experience that combines AI decisions with on-chain execution and auditability.

## Biggest friction/blocker
Cross-stack environment synchronization (contracts, app, indexer, and agent executor mode) and ensuring consistent behavior across local/testnet/mainnet configurations.

## One improvement suggestion
Provide one canonical end-to-end starter template (contracts + frontend + indexer + agent) with predefined environment validation and deployment checklist for bounty teams.

## What worked especially well
Low-cost/final transactions, straightforward EVM tooling compatibility, and the ability to compose Hedera Agent Kit with protocol integrations for autonomous workflows.

## Hedera Testnet Account ID of the team
`<PASTE_ONE_TESTNET_ACCOUNT_ID>`

## Mainnet wallet addresses of all members
`<PASTE_COMMA_SEPARATED_MAINNET_WALLETS>`

## Discord handles of all members
`<PASTE_COMMA_SEPARATED_DISCORD_HANDLES>`

## LinkedIn URLs of all members
`<PASTE_COMMA_SEPARATED_LINKEDIN_URLS>`

## Thoughts on building on Hedera
Hedera is strong for agentic applications that require frequent state updates because fees are predictable and low. The EVM compatibility made smart-contract iteration familiar, while Agent Kit made autonomous execution practical. The main challenge is operational complexity across multiple services; better standardized templates and env validation would reduce setup time.

