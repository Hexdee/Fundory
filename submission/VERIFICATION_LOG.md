# Verification Log (Local)

Date: 2026-03-24

## 1) Contract compile
```bash
cd contracts
npm run compile
```
Result: success (`Nothing to compile`).

## 2) App lint + build
```bash
cd app
npm run lint
npm run build
```
Result: success, all app routes compiled (`/`, `/app`, `/app/goals`, `/app/automation`, `/app/settings`).

## 3) Indexer syntax check
```bash
cd indexer
node --check index.js
```
Result: success.

## 4) End-to-end local smoke (on-chain create + deposit + mode persistence)
```bash
cd contracts
FACTORY_ADDRESS=0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0 \
USDC_ADDRESS=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318 \
STRATEGY_ADDRESS=0x610178dA211FEF7D417bC0e6FeD39F05609AD788 \
npm run smoke:local
```
Result excerpt:
- `goalId`: `1`
- `mode`: `1` (Prized Yield persisted on-chain)
- `vault`: `0x1F708C24a0D3A740cD47cC0444E9480899f3dA7D`
- `totalAssets`: `250000000`
- `txHash`: `0x0b859f624dabb43a367109b2678993855d9f3fb6a07cc22bdf0629de1513900a`

## 5) Demo artifacts generated
```bash
cd app
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:record
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:responsive
npm run deck:pdf
```
Generated files:
- `submission/fundory-demo.webm`
- `submission/pitch-deck.pdf`
- `submission/responsive-check/goals-desktop.png`
- `submission/responsive-check/goals-mobile.png`
- `app/demo-artifacts/final-settings.png`
