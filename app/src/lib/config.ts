import { getAddress, isAddress, type Address } from "viem";

const parseAddress = (value?: string): Address | undefined => {
  if (!value) return undefined;
  if (!isAddress(value)) return undefined;
  return getAddress(value);
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 295);
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "Hedera Mainnet";
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.hashio.io/api";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://hashscan.io/mainnet";

const defaultNativeCurrency =
  chainId === 295 || chainId === 296
    ? { name: "HBAR", symbol: "HBAR", decimals: 18 }
    : { name: "MNT", symbol: "MNT", decimals: 18 };

type BonzoConfig = {
  vaultAddress?: Address;
  depositGuardAddress?: Address;
  vaultDeployerAddress?: Address;
  erc20WrapperAddress?: Address;
};

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

const bonzo: BonzoConfig = {
  // USDC (paired with HBAR) single-sided Bonzo vault on Hedera mainnet.
  vaultAddress: parseAddress(
    process.env.NEXT_PUBLIC_BONZO_VAULT_ADDRESS || "0x1b90B8f8ab3059cf40924338D5292FfbAEd79089"
  ),
  // Bonzo DepositGuard with HTS wrapping support.
  depositGuardAddress: parseAddress(
    process.env.NEXT_PUBLIC_BONZO_DEPOSIT_GUARD_ADDRESS || "0xCEc8716cdd60856eaCaa74d499Abd14AE34B7dA8"
  ),
  // Bonzo vault deployer/Gnosis contract.
  vaultDeployerAddress: parseAddress(
    process.env.NEXT_PUBLIC_BONZO_VAULT_DEPLOYER_ADDRESS || "0xC159b19C5bd0E4a0709eC13C1303Ff2Bb67F7145"
  ),
  // Hedera ERC20 wrapper registry contract.
  erc20WrapperAddress: parseAddress(
    process.env.NEXT_PUBLIC_HEDERA_ERC20_WRAPPER_ADDRESS || "0x000000000000000000000000000000000093A3A8"
  ),
};

export const appConfig = {
  factoryAddress: parseAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
  usdcAddress: parseAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  prizePoolAddress: parseAddress(process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS),
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || "",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL || process.env.NEXT_PUBLIC_INDEXER_URL || "",
  agentExecutor: process.env.NEXT_PUBLIC_AGENT_EXECUTOR || "",
  agentExecuteHeader: process.env.NEXT_PUBLIC_AGENT_EXECUTE_HEADER || "x-agent-api-key",
  agentExecuteApiKey: process.env.NEXT_PUBLIC_AGENT_EXECUTE_API_KEY || "",
  chainId,
  chainIdHex: `0x${chainId.toString(16)}`,
  rpcUrl,
  chainName,
  explorerUrl,
  usdcDecimals: Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || 6),
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  strategies: strategyList,
  bonzo,
  nativeCurrency: defaultNativeCurrency,
  chainParams: {
    chainId: `0x${chainId.toString(16)}`,
    chainName,
    rpcUrls: [rpcUrl],
    blockExplorerUrls: [explorerUrl],
    nativeCurrency: defaultNativeCurrency,
  },
};
