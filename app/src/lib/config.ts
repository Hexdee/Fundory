import type { Address } from "viem";

const parseAddress = (value?: string): Address | undefined => {
  if (!value) return undefined;
  return value as Address;
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 5003);
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "Mantle Testnet (Sepolia)";
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.mantlescan.xyz";

type StrategyConfig = {
  id: string;
  name: string;
  address?: Address;
  aprBps: number;
};

const strategies: StrategyConfig[] = [
  {
    id: "stable",
    name: process.env.NEXT_PUBLIC_STRATEGY_STABLE_NAME || "Stable Yield",
    address: parseAddress(process.env.NEXT_PUBLIC_STRATEGY_STABLE_ADDRESS),
    aprBps: Number(process.env.NEXT_PUBLIC_STRATEGY_STABLE_APR_BPS || 500),
  },
  {
    id: "growth",
    name: process.env.NEXT_PUBLIC_STRATEGY_GROWTH_NAME || "Growth Yield",
    address: parseAddress(process.env.NEXT_PUBLIC_STRATEGY_GROWTH_ADDRESS),
    aprBps: Number(process.env.NEXT_PUBLIC_STRATEGY_GROWTH_APR_BPS || 1000),
  },
];

const strategyList = strategies.filter(
  (strategy): strategy is StrategyConfig & { address: Address } => Boolean(strategy.address)
);

export const appConfig = {
  factoryAddress: parseAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
  usdcAddress: parseAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || "",
  chainId,
  chainIdHex: `0x${chainId.toString(16)}`,
  rpcUrl,
  chainName,
  explorerUrl,
  usdcDecimals: Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || 6),
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  strategies: strategyList,
  chainParams: {
    chainId: `0x${chainId.toString(16)}`,
    chainName,
    rpcUrls: [rpcUrl],
    blockExplorerUrls: [explorerUrl],
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  },
};
