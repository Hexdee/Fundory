"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { appConfig } from "../../lib/config";
import { erc20Abi, factoryAbi, vaultAbi } from "../../lib/abis";
import { useVaultContext } from "../../context/VaultContext";
import { formatAmount } from "../../lib/format";

type GoalInfo = {
  id: bigint;
  owner: string;
  vault: string;
  name: string;
  targetAmount: bigint;
  strategy: string;
  mode: number;
  createdAt: bigint;
  assets: bigint;
};

type StatusState = {
  message: string;
  kind: "idle" | "loading" | "success" | "error";
};

type ActivityItem = {
  id: string;
  type: "Deposit" | "Withdraw";
  amount: bigint;
  vault: string;
  goalName?: string;
  txHash: `0x${string}`;
  timestamp?: number;
};

type GoalMode = "max-yield" | "prized-yield" | "strategy-select";

type AgentSignalSnapshot = {
  fearGreed?: number;
  fearGreedLabel?: string;
  hbarChange24hPct?: number;
  hbarVolatility24hPct?: number;
  errors?: string[];
};

type AgentStrategy = {
  id?: string;
  name?: string;
  note?: string;
  aprBps?: number;
  vault?: string;
  depositToken?: string;
};

type AgentDecision = {
  at?: string;
  action?: string;
  reason?: string;
  riskScore?: number;
  targetRisk?: string;
  selectedStrategy?: AgentStrategy | null;
  signals?: AgentSignalSnapshot | null;
};

type AgentHistoryItem = {
  at?: string;
  action?: string;
  strategyId?: string | null;
  previousStrategyId?: string | null;
  executor?: string;
  executed?: boolean;
  error?: string | null;
  reason?: string;
};

type AgentStatusPayload = {
  enabled?: boolean;
  autoExecute?: boolean;
  walletConfigured?: boolean;
  account?: string | null;
  executor?: string;
  hakAvailable?: boolean;
  lastRunAt?: string | null;
  lastDecision?: AgentDecision | null;
  lastExecution?: {
    executedAt?: string;
    strategyId?: string;
    executor?: string;
  } | null;
  history?: AgentHistoryItem[];
  intervalMs?: number;
  minRebalanceMs?: number;
  executeAuthRequired?: boolean;
  executeAuthHeader?: string;
};

const initialStatus: StatusState = { message: "", kind: "idle" };

const GOAL_MODE_CONFIG: Record<
  GoalMode,
  {
    label: string;
    shortLabel: string;
    description: string;
    engine: string;
  }
> = {
  "max-yield": {
    label: "Max Yield",
    shortLabel: "Max Yield",
    description: "Autobalances into the best live yield route automatically.",
    engine: "Autobalanced Yield Account",
  },
  "prized-yield": {
    label: "Prized Yield",
    shortLabel: "Prized Yield",
    description: "Principal stays safe while yield is directed to prize opportunities.",
    engine: "Prize Yield Account",
  },
  "strategy-select": {
    label: "Select a Strategy",
    shortLabel: "Strategy",
    description: "You pick and lock a preferred strategy for this goal.",
    engine: "Fixed Strategy Account",
  },
};

const GOAL_MODE_TO_ONCHAIN: Record<GoalMode, number> = {
  "max-yield": 0,
  "prized-yield": 1,
  "strategy-select": 2,
};

const onchainModeToGoalMode = (value: number): GoalMode => {
  if (value === 1) return "prized-yield";
  if (value === 2) return "strategy-select";
  return "max-yield";
};

const getStrategyRiskLabel = (aprBps?: number) => {
  if (!aprBps) return "Unknown";
  if (aprBps <= 500) return "Low";
  if (aprBps <= 900) return "Medium";
  return "Medium-High";
};

export type WorkspaceRouteView = "dashboard" | "goals" | "automation" | "settings";

type AppWorkspaceProps = {
  initialView?: WorkspaceRouteView;
};

export default function AppWorkspace({ initialView = "dashboard" }: AppWorkspaceProps) {
  const { address, isConnected, chain } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { selectedGoalId, selectedVault, setSelectedGoalId, setSelectedVault } = useVaultContext();

  const [goals, setGoals] = useState<GoalInfo[]>([]);
  const [goalName, setGoalName] = useState<string>("");
  const [goalTarget, setGoalTarget] = useState<string>("");
  const [goalModeDraft, setGoalModeDraft] = useState<GoalMode>("max-yield");
  const [goalCreateStep, setGoalCreateStep] = useState<1 | 2 | 3>(1);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [agentUiStatus, setAgentUiStatus] = useState<StatusState>(initialStatus);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<GoalInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isGoalsLoading, setIsGoalsLoading] = useState(false);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentStatusData, setAgentStatusData] = useState<AgentStatusPayload | null>(null);
  const [agentDecisionData, setAgentDecisionData] = useState<AgentDecision | null>(null);
  const activeView: WorkspaceRouteView = initialView;

  const factoryAddress = appConfig.factoryAddress;
  const usdcAddress = appConfig.usdcAddress;
  const strategies = appConfig.strategies;

  const strategyMap = useMemo(() => {
    return new Map(strategies.map((strategy) => [strategy.address.toLowerCase(), strategy]));
  }, [strategies]);

  const maxYieldStrategy = useMemo(() => {
    if (strategies.length === 0) return undefined;
    return [...strategies].sort((a, b) => b.aprBps - a.aprBps)[0];
  }, [strategies]);

  const safestStrategy = useMemo(() => {
    if (strategies.length === 0) return undefined;
    return [...strategies].sort((a, b) => a.aprBps - b.aprBps)[0];
  }, [strategies]);

  const selectedStrategyInfo = useMemo(() => {
    if (!selectedStrategy) return undefined;
    return strategyMap.get(selectedStrategy.toLowerCase());
  }, [selectedStrategy, strategyMap]);

  const resolveStrategyForMode = useCallback(
    (mode: GoalMode): string | undefined => {
      if (mode === "max-yield") return maxYieldStrategy?.address;
      if (mode === "prized-yield") return safestStrategy?.address;
      return selectedStrategyInfo?.address;
    },
    [maxYieldStrategy?.address, safestStrategy?.address, selectedStrategyInfo?.address]
  );

  const goalModeOptions = useMemo(
    () => [
      {
        id: "max-yield" as GoalMode,
        label: GOAL_MODE_CONFIG["max-yield"].label,
        description: GOAL_MODE_CONFIG["max-yield"].description,
        isDefault: true,
      },
      {
        id: "prized-yield" as GoalMode,
        label: GOAL_MODE_CONFIG["prized-yield"].label,
        description: GOAL_MODE_CONFIG["prized-yield"].description,
        isDefault: false,
      },
      {
        id: "strategy-select" as GoalMode,
        label: GOAL_MODE_CONFIG["strategy-select"].label,
        description: GOAL_MODE_CONFIG["strategy-select"].description,
        isDefault: false,
      },
    ],
    []
  );

  const getStrategyLabel = useCallback(
    (strategyAddress?: string) => {
      if (!strategyAddress) return "Unknown strategy";
      const info = strategyMap.get(strategyAddress.toLowerCase());
      if (!info) return `${strategyAddress.slice(0, 6)}...${strategyAddress.slice(-4)}`;
      return `${info.name} (${(info.aprBps / 100).toFixed(2)}% APR)`;
    },
    [strategyMap]
  );

  const getGoalMode = useCallback(
    (goal: GoalInfo): GoalMode => {
      return onchainModeToGoalMode(goal.mode);
    },
    []
  );

  const { data: goalIds, refetch: refetchGoals } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "getGoalsByOwner",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(factoryAddress && address) },
  });

  const loadGoals = useCallback(
    async (ids?: readonly bigint[]) => {
      if (!publicClient || !factoryAddress || !ids || ids.length === 0) {
        setGoals([]);
        setIsGoalsLoading(false);
        return;
      }

      setIsGoalsLoading(true);
      try {
        const fetched = await Promise.all(
          ids.map(async (id) => {
            const result = await publicClient.readContract({
              address: factoryAddress,
              abi: factoryAbi,
              functionName: "goals",
              args: [id],
            });

            const [owner, vault, name, targetAmount, strategy, mode, createdAt] = result;

            let assets = 0n;
            if (isAddress(vault)) {
              try {
                assets = await publicClient.readContract({
                  address: getAddress(vault),
                  abi: vaultAbi,
                  functionName: "totalAssets",
                });
              } catch (err) {
                console.error(err);
              }
            }

            return {
              id,
              owner,
              vault,
              name,
              targetAmount,
              strategy,
              mode,
              createdAt,
              assets,
            } as GoalInfo;
          })
        );

        setGoals(fetched);

        const hasSelected = selectedGoalId ? fetched.some((goal) => goal.id === selectedGoalId) : false;
        if ((!selectedGoalId || !hasSelected) && fetched.length > 0) {
          setSelectedGoalId(fetched[0].id);
          if (isAddress(fetched[0].vault)) {
            setSelectedVault(getAddress(fetched[0].vault));
          }
        }
      } finally {
        setIsGoalsLoading(false);
      }
    },
    [publicClient, factoryAddress, selectedGoalId, setSelectedGoalId, setSelectedVault]
  );

  useEffect(() => {
    let cancelled = false;

    loadGoals(goalIds as readonly bigint[] | undefined).catch((err) => {
      console.error(err);
      if (!cancelled) setGoals([]);
    });

    return () => {
      cancelled = true;
    };
  }, [goalIds, loadGoals]);

  const selectedGoal = useMemo(() => {
    if (!selectedGoalId) return undefined;
    return goals.find((goal) => goal.id === selectedGoalId);
  }, [goals, selectedGoalId]);

  const selectedGoalMode: GoalMode = selectedGoal ? getGoalMode(selectedGoal) : "max-yield";

  const activeVault = useMemo(() => {
    if (selectedVault) return selectedVault;
    if (selectedGoal?.vault && isAddress(selectedGoal.vault)) return getAddress(selectedGoal.vault);
    return undefined;
  }, [selectedGoal, selectedVault]);

  const depositVault = useMemo(() => {
    if (depositGoal?.vault && isAddress(depositGoal.vault)) return getAddress(depositGoal.vault);
    return activeVault;
  }, [depositGoal, activeVault]);

  const { data: totalShares } = useReadContract({
    address: activeVault,
    abi: vaultAbi,
    functionName: "totalShares",
    query: { enabled: Boolean(activeVault) },
  });

  const { data: userShares } = useReadContract({
    address: activeVault,
    abi: vaultAbi,
    functionName: "shares",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(activeVault && address) },
  });

  const { data: totalAssets } = useReadContract({
    address: activeVault,
    abi: vaultAbi,
    functionName: "totalAssets",
    query: { enabled: Boolean(activeVault) },
  });

  const { data: pricePerShare } = useReadContract({
    address: activeVault,
    abi: vaultAbi,
    functionName: "pricePerShareE18",
    query: { enabled: Boolean(activeVault) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && depositVault ? [address, depositVault] : undefined,
    query: { enabled: Boolean(address && depositVault && usdcAddress) },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && usdcAddress) },
  });

  const allowanceFormatted = formatAmount(allowance, appConfig.usdcDecimals);
  const balanceFormatted = formatAmount(balance, appConfig.usdcDecimals);
  const totalSaved = useMemo(() => goals.reduce((acc, goal) => acc + (goal.assets || 0n), 0n), [goals]);
  const assetsFormatted = formatAmount(totalSaved, appConfig.usdcDecimals);
  const ppsFormatted = formatAmount(pricePerShare, 18);

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount) return null;
    try {
      return parseUnits(depositAmount, appConfig.usdcDecimals);
    } catch {
      return null;
    }
  }, [depositAmount]);

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount) return null;
    try {
      return parseUnits(withdrawAmount, appConfig.usdcDecimals);
    } catch {
      return null;
    }
  }, [withdrawAmount]);

  const parsedGoalTarget = useMemo(() => {
    if (!goalTarget) return null;
    try {
      return parseUnits(goalTarget, appConfig.usdcDecimals);
    } catch {
      return null;
    }
  }, [goalTarget]);

  const allowanceValue = allowance ?? 0n;
  const balanceValue = balance ?? 0n;
  const hasDepositAmount = parsedDepositAmount !== null && parsedDepositAmount > 0n;
  const canDeposit =
    Boolean(depositVault && address && hasDepositAmount) &&
    parsedDepositAmount !== null &&
    parsedDepositAmount <= allowanceValue &&
    parsedDepositAmount <= balanceValue;

  const maxWithdraw = useMemo(() => {
    if (!totalAssets || !totalShares || !userShares || totalShares === 0n) return 0n;
    return (userShares * totalAssets) / totalShares;
  }, [totalAssets, totalShares, userShares]);

  const maxWithdrawFormatted = formatAmount(maxWithdraw, appConfig.usdcDecimals);
  const hasWithdrawAmount = parsedWithdrawAmount !== null && parsedWithdrawAmount > 0n;
  const canWithdraw =
    Boolean(activeVault && address && hasWithdrawAmount) &&
    parsedWithdrawAmount !== null &&
    parsedWithdrawAmount <= maxWithdraw;

  const userValue = useMemo(() => {
    if (!totalAssets || !totalShares || !userShares || totalShares === 0n) return 0n;
    return (userShares * totalAssets) / totalShares;
  }, [totalAssets, totalShares, userShares]);

  const userValueFormatted = formatAmount(userValue, appConfig.usdcDecimals);
  const userSharesFormatted = formatAmount(userShares, appConfig.usdcDecimals);
  const estimatedYield = useMemo(() => {
    if (!userShares || userValue <= userShares) return 0n;
    return userValue - userShares;
  }, [userShares, userValue]);
  const estimatedYieldFormatted = formatAmount(estimatedYield, appConfig.usdcDecimals);

  const formatProgress = (assets?: bigint, target?: bigint) => {
    if (!assets || !target || target === 0n) return "0%";
    const bp = (assets * 10000n) / target;
    const capped = bp > 10000n ? 10000n : bp;
    const pct = Number(capped) / 100;
    return `${pct.toFixed(1)}%`;
  };

  const detailTarget = selectedGoal
    ? formatAmount(selectedGoal.targetAmount, appConfig.usdcDecimals)
    : "0.00";
  const detailSaved = selectedGoal ? formatAmount(selectedGoal.assets, appConfig.usdcDecimals) : "0.00";
  const detailProgress = formatProgress(selectedGoal?.assets, selectedGoal?.targetAmount);
  const createdDate = selectedGoal?.createdAt
    ? new Date(Number(selectedGoal.createdAt) * 1000).toLocaleDateString()
    : "-";
  const selectedStrategyLabel = selectedGoal ? getStrategyLabel(selectedGoal.strategy) : "-";

  const goalModeCounts = useMemo(() => {
    return goals.reduce(
      (acc, goal) => {
        const mode = getGoalMode(goal);
        acc[mode] += 1;
        return acc;
      },
      {
        "max-yield": 0,
        "prized-yield": 0,
        "strategy-select": 0,
      } as Record<GoalMode, number>
    );
  }, [goals, getGoalMode]);

  const agentStatusLabel =
    agentStatusData?.enabled === false
      ? "Disabled"
      : agentStatusData?.autoExecute
        ? "Auto"
        : agentStatusData
          ? "Manual"
          : "Unavailable";

  const shortAddress = (value?: string | null) => {
    if (!value) return "-";
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "Just now";
    return new Date(ts * 1000).toLocaleString();
  };

  const formatIsoDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const resetStatus = () => setStatus(initialStatus);
  const closeGoalModal = () => {
    setIsGoalModalOpen(false);
    setGoalCreateStep(1);
  };

  const handleConnect = async (connectorIndex: number) => {
    resetStatus();
    const connector = connectors[connectorIndex];
    if (!connector) return;
    try {
      setStatus({ message: "Connecting wallet...", kind: "loading" });
      await connectAsync({ connector, chainId: appConfig.chainId });
      setStatus({ message: "Wallet connected.", kind: "success" });
      setIsConnectOpen(false);
    } catch (err: unknown) {
      const error = err as { shortMessage?: string; message?: string };
      setStatus({ message: error.shortMessage || error.message || "Connect failed.", kind: "error" });
    }
  };

  const ensureNetwork = useCallback(async () => {
    if (!isConnected) return;
    if (chain?.id === appConfig.chainId) return;
    try {
      await switchChainAsync({ chainId: appConfig.chainId });
      return;
    } catch (err) {
      const ethereum = (window as { ethereum?: { request?: (args: unknown) => Promise<void> } }).ethereum;
      if (!ethereum?.request) throw err;
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: appConfig.chainIdHex }],
        });
      } catch (switchErr) {
        const maybeCode = switchErr as { code?: number };
        if (maybeCode?.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [appConfig.chainParams],
          });
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: appConfig.chainIdHex }],
          });
        } else {
          throw switchErr;
        }
      }
    }
  }, [isConnected, chain?.id, switchChainAsync]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedStrategy && strategies.length > 0) {
      setSelectedStrategy(maxYieldStrategy?.address || strategies[0].address);
    }
  }, [selectedStrategy, strategies, maxYieldStrategy]);

  useEffect(() => {
    if (!isConnected) return;
    ensureNetwork().catch((err) => {
      console.error(err);
      setStatus({ message: "Please switch to the configured network.", kind: "error" });
    });
  }, [isConnected, ensureNetwork]);

  const handleCreateGoal = async () => {
    const resolvedStrategy = resolveStrategyForMode(goalModeDraft);
    const normalizedGoalName = goalName.trim();
    if (!factoryAddress || !normalizedGoalName || !parsedGoalTarget || parsedGoalTarget <= 0n || !resolvedStrategy) {
      setStatus({
        message: "Set goal basics and a valid mode strategy before creating.",
        kind: "error",
      });
      return;
    }

    if (!isAddress(resolvedStrategy)) {
      setStatus({ message: "Selected strategy address is invalid.", kind: "error" });
      return;
    }

    try {
      setStatus({ message: "Creating goal vault...", kind: "loading" });
      const onchainMode = GOAL_MODE_TO_ONCHAIN[goalModeDraft];

      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "createGoal",
        args: [normalizedGoalName, parsedGoalTarget, getAddress(resolvedStrategy), onchainMode],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const refreshed = await refetchGoals();
      const refreshedIds = (refreshed.data as readonly bigint[] | undefined) || [];
      await loadGoals(refreshedIds);

      setGoalName("");
      setGoalTarget("");
      setGoalModeDraft("max-yield");
      setGoalCreateStep(1);
      setStatus({ message: "Goal created.", kind: "success" });
      closeGoalModal();
    } catch (err: unknown) {
      const error = err as { shortMessage?: string; message?: string };
      setStatus({ message: error.shortMessage || error.message || "Goal creation failed.", kind: "error" });
    }
  };

  const handleApprove = async () => {
    if (!usdcAddress || !depositVault) {
      setStatus({ message: "Missing USDC or vault address.", kind: "error" });
      return;
    }
    try {
      setStatus({ message: "Sending approval transaction...", kind: "loading" });
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [depositVault, parseUnits("1000000000", appConfig.usdcDecimals)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAllowance();
      setStatus({ message: "Approval confirmed.", kind: "success" });
    } catch (err: unknown) {
      const error = err as { shortMessage?: string; message?: string };
      setStatus({ message: error.shortMessage || error.message || "Approval failed.", kind: "error" });
    }
  };

  const handleDeposit = async () => {
    if (!depositVault || !address) {
      setStatus({ message: "Connect wallet and select a vault.", kind: "error" });
      return;
    }
    if (!depositAmount) {
      setStatus({ message: "Enter a deposit amount.", kind: "error" });
      return;
    }
    try {
      await ensureNetwork();
      setStatus({ message: "Submitting deposit...", kind: "loading" });
      const amount = parseUnits(depositAmount, appConfig.usdcDecimals);
      const hash = await writeContractAsync({
        address: depositVault,
        abi: vaultAbi,
        functionName: "deposit",
        args: [amount],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        const refreshed = await refetchGoals();
        await loadGoals(refreshed.data as readonly bigint[] | undefined);
      }
      await refetchBalance();
      await refetchAllowance();
      setStatus({ message: "Deposit confirmed.", kind: "success" });
      setDepositAmount("");
      setIsDepositModalOpen(false);
    } catch (err: unknown) {
      const error = err as { shortMessage?: string; message?: string };
      setStatus({ message: error.shortMessage || error.message || "Deposit failed.", kind: "error" });
    }
  };

  const handleWithdraw = async () => {
    if (!activeVault || !address) {
      setStatus({ message: "Connect wallet and select a vault.", kind: "error" });
      return;
    }
    if (!parsedWithdrawAmount) {
      setStatus({ message: "Enter a withdraw amount.", kind: "error" });
      return;
    }
    try {
      await ensureNetwork();
      setStatus({ message: "Submitting withdrawal...", kind: "loading" });
      const hash = await writeContractAsync({
        address: activeVault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [parsedWithdrawAmount],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        const refreshed = await refetchGoals();
        await loadGoals(refreshed.data as readonly bigint[] | undefined);
      }
      await refetchBalance();
      setStatus({ message: "Withdrawal confirmed.", kind: "success" });
      setWithdrawAmount("");
      setIsWithdrawModalOpen(false);
    } catch (err: unknown) {
      const error = err as { shortMessage?: string; message?: string };
      setStatus({ message: error.shortMessage || error.message || "Withdrawal failed.", kind: "error" });
    }
  };

  const loadActivities = useCallback(async () => {
    if (!appConfig.indexerUrl || goals.length === 0) {
      setActivities([]);
      setIsActivitiesLoading(false);
      return;
    }

    setIsActivitiesLoading(true);
    try {
      const vaults = goals
        .map((goal) => goal.vault)
        .filter((vault) => isAddress(vault))
        .map((vault) => getAddress(vault))
        .join(",");

      const url = new URL(`${appConfig.indexerUrl}/activity`);
      if (vaults) url.searchParams.set("vaults", vaults);
      url.searchParams.set("limit", "8");

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Indexer error");

      const data = (await res.json()) as {
        activities: Array<Omit<ActivityItem, "amount"> & { amount: string }>;
      };

      const parsed = (data.activities || []).map((item) => ({
        ...item,
        amount: BigInt(item.amount),
      }));
      setActivities(parsed);
    } catch (err) {
      console.error(err);
      setActivities([]);
    } finally {
      setIsActivitiesLoading(false);
    }
  }, [goals]);

  useEffect(() => {
    loadActivities().catch((err) => console.error(err));
  }, [loadActivities]);

  const fetchAgentData = useCallback(async () => {
    if (!appConfig.agentUrl) {
      setAgentStatusData(null);
      setAgentDecisionData(null);
      return;
    }

    setIsAgentLoading(true);
    try {
      const [statusRes, decisionRes] = await Promise.all([
        fetch(`${appConfig.agentUrl}/agent/status`, { cache: "no-store" }),
        fetch(`${appConfig.agentUrl}/agent/decision`, { cache: "no-store" }),
      ]);

      if (statusRes.ok) {
        const statusPayload = (await statusRes.json()) as AgentStatusPayload;
        setAgentStatusData(statusPayload);
        setAgentDecisionData((prev) => prev || statusPayload.lastDecision || null);
      }

      if (decisionRes.ok) {
        const decisionPayload = (await decisionRes.json()) as { decision?: AgentDecision };
        setAgentDecisionData(decisionPayload.decision || null);
      }
    } catch (err) {
      console.error(err);
      setAgentUiStatus({ message: "Could not load automation data.", kind: "error" });
    } finally {
      setIsAgentLoading(false);
    }
  }, []);

  const handleRunAgent = async () => {
    if (!appConfig.agentUrl) {
      setAgentUiStatus({ message: "Agent URL is not configured.", kind: "error" });
      return;
    }

    try {
      setAgentUiStatus({ message: "Requesting manual agent cycle...", kind: "loading" });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (appConfig.agentExecuteApiKey) {
        headers[appConfig.agentExecuteHeader] = appConfig.agentExecuteApiKey;
      }

      const res = await fetch(`${appConfig.agentUrl}/agent/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          manual: true,
          executor: appConfig.agentExecutor || undefined,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        execution?: unknown;
        decision?: unknown;
        skipped?: boolean;
        reason?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error || "Execution request failed.");
      }

      if (payload.execution) {
        setAgentUiStatus({ message: "Automation run executed.", kind: "success" });
      } else if (payload.skipped) {
        setAgentUiStatus({ message: `Run skipped: ${payload.reason || "no action"}.`, kind: "success" });
      } else if (payload.decision) {
        setAgentUiStatus({ message: "Decision generated. No execution performed.", kind: "success" });
      } else {
        setAgentUiStatus({ message: "Automation request completed.", kind: "success" });
      }

      await fetchAgentData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setAgentUiStatus({ message: error.message || "Automation execution failed.", kind: "error" });
    }
  };

  useEffect(() => {
    if (activeView !== "automation" && activeView !== "dashboard") return;
    fetchAgentData().catch((err) => console.error(err));
  }, [activeView, fetchAgentData]);

  const walletStatus = mounted
    ? isConnected && address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "Not connected"
    : "...";
  const chainLabel = mounted ? (chain?.name || appConfig.chainName) : appConfig.chainName;
  const networkMismatch = mounted && isConnected && chain?.id !== appConfig.chainId;

  const viewTitle =
    activeView === "dashboard"
      ? "Portfolio Overview"
      : activeView === "goals"
        ? "Goals Command Center"
        : activeView === "automation"
          ? "Automation Orchestrator"
          : "Settings";

  const viewSubtitle =
    activeView === "dashboard"
      ? "Your goals, yield allocation, and latest protocol activity at a glance."
      : activeView === "goals"
        ? "Manage every goal end-to-end: progress, mode, strategy, and money actions in one place."
        : activeView === "automation"
          ? "Simple control for automated goal actions and recent activity."
          : "Manage wallet, safety defaults, notifications, and data permissions.";

  const draftModeStrategyAddress = resolveStrategyForMode(goalModeDraft);
  const draftModeStrategyLabel = getStrategyLabel(draftModeStrategyAddress);
  const hasGoalBasics = goalName.trim().length > 0 && parsedGoalTarget !== null && parsedGoalTarget > 0n;
  const hasModeRoute =
    Boolean(draftModeStrategyAddress) &&
    (goalModeDraft !== "strategy-select" || Boolean(selectedStrategyInfo));

  const selectedGoalAprBps = selectedGoal
    ? strategyMap.get(selectedGoal.strategy.toLowerCase())?.aprBps || 0
    : 0;

  const prizeTicketUnit = 10n * 10n ** BigInt(appConfig.usdcDecimals);
  const selectedGoalTickets = selectedGoal ? selectedGoal.assets / prizeTicketUnit : 0n;

  const goalDetailHeader = selectedGoal
    ? `${selectedGoal.name} · ${GOAL_MODE_CONFIG[selectedGoalMode].label}`
    : "Select a goal";
  const explorerBaseUrl = appConfig.explorerUrl.replace(/\/$/, "");
  const factoryExplorerUrl = factoryAddress ? `${explorerBaseUrl}/address/${factoryAddress}` : "";
  const prizePoolExplorerUrl = appConfig.prizePoolAddress
    ? `${explorerBaseUrl}/address/${appConfig.prizePoolAddress}`
    : "";
  const usdcExplorerUrl = usdcAddress ? `${explorerBaseUrl}/address/${usdcAddress}` : "";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Image className="brand-badge" src="/fundory-logo.svg" alt="Fundory logo" width={28} height={28} />
          Fundory
        </div>
        <p className="sidebar-label">Workspace</p>
        <nav>
          {[
            { id: "dashboard", label: "Overview", href: "/app" },
            { id: "goals", label: "Goals", href: "/app/goals" },
            { id: "automation", label: "Automation", href: "/app/automation" },
            { id: "settings", label: "Settings", href: "/app/settings" },
          ].map((item) => (
            <Link
              key={item.id}
              className={`nav-link ${activeView === item.id ? "active" : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="vault-summary">
          <h4>Total saved</h4>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>${assetsFormatted}</p>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{goals.length} goals tracked</p>
        </div>
        <div className="vault-summary">
          <span className="tag">Prized goals</span>
          <p style={{ margin: "12px 0 0", color: "var(--muted)" }}>
            {goalModeCounts["prized-yield"]} goals are using principal-protected prize mode.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/">
          Back to landing
        </Link>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h2>{viewTitle}</h2>
            <p>{viewSubtitle}</p>
          </div>
          <div className="wallet">
            <span className="badge" suppressHydrationWarning>
              {chainLabel}
            </span>
            <span suppressHydrationWarning>{walletStatus}</span>
            {mounted ? (
              isConnected ? (
                <button className="btn btn-secondary" onClick={() => disconnect()} type="button">
                  Disconnect
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setIsConnectOpen(true)} type="button">
                  Connect wallet
                </button>
              )
            ) : (
              <button className="btn btn-primary" type="button" disabled>
                Connect wallet
              </button>
            )}
          </div>
        </header>

        <section className="kpi-strip">
          <div className="kpi-card">
            <span className="kpi-label">Total Saved</span>
            <strong>${assetsFormatted}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Goals</span>
            <strong>{goals.length}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Prized Goals</span>
            <strong>{goalModeCounts["prized-yield"]}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Agent Mode</span>
            <strong>{agentStatusLabel}</strong>
            <span className={`kpi-chip ${agentStatusLabel === "Disabled" ? "warn" : "ok"}`}>{agentStatusLabel}</span>
          </div>
        </section>

        {activeView === "dashboard" ? (
          <section className="grid dashboard-grid">
            <div className="card dashboard-goal-progress-card">
              <div className="card-header">
                <h3>Goal Progress</h3>
                <Link className="btn btn-secondary btn-small" href="/app/goals">
                  Open goals
                </Link>
              </div>
              {goals.length === 0 ? (
                <div className="empty-state">No goals yet. Create one to start your savings journey.</div>
              ) : (
                <div className="goals-list" style={{ maxHeight: 320 }}>
                  {goals.map((goal) => {
                    const progress = formatProgress(goal.assets, goal.targetAmount);
                    const mode = getGoalMode(goal);
                    return (
                      <div
                        key={goal.id.toString()}
                        className="goal-card"
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          if (isAddress(goal.vault)) setSelectedVault(getAddress(goal.vault));
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="goal-meta">
                          <div>
                            <div className="goal-title">{goal.name}</div>
                            <div className="goal-subtitle">{GOAL_MODE_CONFIG[mode].shortLabel}</div>
                          </div>
                          <span className="pill-small">{progress}</span>
                        </div>
                        <div className="progress-track" style={{ "--progress": progress } as React.CSSProperties}>
                          <span />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card dashboard-activity-card">
              <h3>Recent Activity</h3>
              {isActivitiesLoading ? (
                <div className="empty-state">Loading activity...</div>
              ) : activities.length === 0 ? (
                <div className="empty-state">No activity yet.</div>
              ) : (
                <div className="activity">
                  {activities.map((item) => (
                    <div className="activity-item" key={item.id}>
                      <div style={{ fontWeight: 600 }}>
                        {item.type} ${formatAmount(item.amount, appConfig.usdcDecimals)}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4 }}>
                        {item.goalName || shortAddress(item.vault)} - {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card dashboard-automation-pulse-card">
              <div className="card-header">
                <h3>Automation Pulse</h3>
                <button className="btn btn-secondary btn-small" type="button" onClick={handleRunAgent}>
                  Run now
                </button>
              </div>
              {!appConfig.agentUrl ? (
                <div className="empty-state">Set NEXT_PUBLIC_AGENT_URL to enable live automation telemetry.</div>
              ) : isAgentLoading ? (
                <div className="empty-state">Loading automation status...</div>
              ) : (
                <div className="detail-grid">
                  <div className="detail-row">
                    <span>Executor</span>
                    <span>{agentStatusData?.executor || appConfig.agentExecutor || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Last run</span>
                    <span>{formatIsoDate(agentStatusData?.lastRunAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Latest action</span>
                    <span>{agentDecisionData?.action || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Target risk</span>
                    <span>{agentDecisionData?.targetRisk || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Selected strategy</span>
                    <span>{agentDecisionData?.selectedStrategy?.name || "-"}</span>
                  </div>
                </div>
              )}
              {agentUiStatus.message ? <div className="status">{agentUiStatus.message}</div> : null}
            </div>
          </section>
        ) : null}

        {activeView === "goals" ? (
          <section className="grid-split goals-grid">
            <div className="card goals-list-card">
              <div className="card-header">
                <h3>Goals List</h3>
                <button
                  className="btn btn-secondary btn-small btn-icon"
                  type="button"
                  onClick={() => {
                    resetStatus();
                    setGoalCreateStep(1);
                    setIsGoalModalOpen(true);
                  }}
                >
                  <span aria-hidden="true">+</span>
                  New goal
                </button>
              </div>

              {goals.length === 0 ? (
                isGoalsLoading ? (
                  <div className="empty-state">Loading goals...</div>
                ) : (
                  <div className="empty-state">No goals yet. Create your first goal to start saving.</div>
                )
              ) : (
                <div className="goals-list">
                  {goals.map((goal) => {
                    const saved = formatAmount(goal.assets, appConfig.usdcDecimals);
                    const targetFormatted = formatAmount(goal.targetAmount, appConfig.usdcDecimals);
                    const progress = formatProgress(goal.assets, goal.targetAmount);
                    const mode = getGoalMode(goal);

                    return (
                      <div
                        className={`goal-card ${goal.id === selectedGoalId ? "selected" : ""}`}
                        key={goal.id.toString()}
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          if (isAddress(goal.vault)) setSelectedVault(getAddress(goal.vault));
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="goal-meta">
                          <div>
                            <div className="goal-title">{goal.name}</div>
                            <div className="goal-subtitle">
                              ${saved} saved of ${targetFormatted}
                            </div>
                          </div>
                          <div className="goal-actions">
                            <span className="pill-small">{GOAL_MODE_CONFIG[mode].shortLabel}</span>
                          </div>
                        </div>
                        <div className="progress-track" style={{ "--progress": progress } as React.CSSProperties}>
                          <span />
                        </div>
                        <div className="goal-meta">
                          <div className="goal-subtitle">{progress} complete</div>
                          <div className="goal-actions">
                            <span
                              className="goal-link"
                              role="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                resetStatus();
                                setDepositGoal(goal);
                                setSelectedGoalId(goal.id);
                                if (isAddress(goal.vault)) setSelectedVault(getAddress(goal.vault));
                                setIsDepositModalOpen(true);
                              }}
                            >
                              Deposit
                            </span>
                            <span className="vault-pill">Vault {goal.vault.slice(0, 6)}...</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card goal-withdraw-card">
              <div className="card-header">
                <h3>{goalDetailHeader}</h3>
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() => {
                    resetStatus();
                    setIsWithdrawModalOpen(true);
                  }}
                  disabled={!activeVault}
                >
                  Withdraw
                </button>
              </div>

              {!selectedGoal ? (
                <div className="empty-state">Select a goal to open mode-specific detail.</div>
              ) : (
                <>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Goal engine</span>
                      <span>{GOAL_MODE_CONFIG[selectedGoalMode].engine}</span>
                    </div>
                    <div className="detail-row">
                      <span>Vault</span>
                      <span>{activeVault ? shortAddress(activeVault) : "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span>Strategy</span>
                      <span className="detail-strategy">{selectedStrategyLabel}</span>
                    </div>
                    <div className="detail-row">
                      <span>Created</span>
                      <span>{createdDate}</span>
                    </div>
                    <div className="detail-row">
                      <span>Your shares</span>
                      <span>{userSharesFormatted}</span>
                    </div>
                    <div className="detail-row">
                      <span>Current value</span>
                      <span
                        title={`$${formatUnits(userValue, appConfig.usdcDecimals)}`}
                        style={{ cursor: "help" }}
                      >
                        ${userValueFormatted}
                      </span>
                    </div>
                  </div>

                  <div className="goal" style={{ paddingTop: 8 }}>
                    <div className="progress-track" style={{ "--progress": detailProgress } as React.CSSProperties}>
                      <span />
                    </div>
                    <div className="goal-subtitle">{detailProgress} complete</div>
                  </div>

                  <p style={{ color: "var(--muted)", margin: "12px 0" }}>
                    Saved: ${detailSaved} of ${detailTarget} - PPS: {ppsFormatted}
                  </p>

                  {selectedGoalMode === "max-yield" ? (
                    <div className="mode-block">
                      <div className="mode-summary">
                        <span>Max Yield View</span>
                        <strong>Autonomous optimization with dynamic strategy rotation.</strong>
                      </div>
                      <div className="detail-grid">
                        <div className="detail-row">
                          <span>Current est. APR</span>
                          <span>{(selectedGoalAprBps / 100).toFixed(2)}%</span>
                        </div>
                        <div className="detail-row">
                          <span>Best candidate now</span>
                          <span>{maxYieldStrategy ? maxYieldStrategy.name : "-"}</span>
                        </div>
                        <div className="detail-row">
                          <span>Yield (est.)</span>
                          <span>${estimatedYieldFormatted}</span>
                        </div>
                      </div>
                      <div className="mode-actions">
                        <button className="btn btn-primary btn-small" type="button" onClick={handleRunAgent}>
                          Run rebalance now
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          type="button"
                          onClick={() => {
                            setDepositGoal(selectedGoal);
                            setIsDepositModalOpen(true);
                          }}
                        >
                          Deposit
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectedGoalMode === "prized-yield" ? (
                    <div className="mode-block">
                      <div className="mode-summary">
                        <span>Prized Yield View</span>
                        <strong>Principal-protected savings, yield flows to prize mechanics.</strong>
                      </div>
                      <div className="detail-grid">
                        <div className="detail-row">
                          <span>Safety strategy</span>
                          <span>{safestStrategy ? safestStrategy.name : selectedStrategyLabel}</span>
                        </div>
                        <div className="detail-row">
                          <span>Est. tickets</span>
                          <span>{selectedGoalTickets.toString()}</span>
                        </div>
                        <div className="detail-row">
                          <span>Prize pool</span>
                          <span>{shortAddress(appConfig.prizePoolAddress)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Principal withdrawability</span>
                          <span>Anytime</span>
                        </div>
                      </div>
                      <div className="mode-actions">
                        <button
                          className="btn btn-primary btn-small"
                          type="button"
                          onClick={() => {
                            setDepositGoal(selectedGoal);
                            setIsDepositModalOpen(true);
                          }}
                        >
                          Deposit principal
                        </button>
                        <button className="btn btn-secondary btn-small" type="button" onClick={() => setIsWithdrawModalOpen(true)}>
                          Withdraw principal
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectedGoalMode === "strategy-select" ? (
                    <div className="mode-block">
                      <div className="mode-summary">
                        <span>Strategy-Locked View</span>
                        <strong>Manual strategy mode. User selects and keeps a fixed route.</strong>
                      </div>
                      <div className="detail-grid">
                        <div className="detail-row">
                          <span>Locked strategy</span>
                          <span>{selectedStrategyLabel}</span>
                        </div>
                        <div className="detail-row">
                          <span>Risk level</span>
                          <span>{getStrategyRiskLabel(selectedGoalAprBps)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Autobalance</span>
                          <span>Disabled</span>
                        </div>
                        <div className="detail-row">
                          <span>Yield (est.)</span>
                          <span>${estimatedYieldFormatted}</span>
                        </div>
                      </div>
                      <div className="mode-actions">
                        <button
                          className="btn btn-primary btn-small"
                          type="button"
                          onClick={() => {
                            setDepositGoal(selectedGoal);
                            setIsDepositModalOpen(true);
                          }}
                        >
                          Approve + deposit
                        </button>
                        <button className="btn btn-secondary btn-small" type="button" onClick={() => setIsWithdrawModalOpen(true)}>
                          Withdraw
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "automation" ? (
          <section className="grid automation-grid">
            <div className="card">
              <div className="card-header">
                <h3>Status & Controls</h3>
                <button className="btn btn-secondary btn-small" type="button" onClick={() => fetchAgentData()}>
                  Refresh
                </button>
              </div>
              {!appConfig.agentUrl ? (
                <div className="empty-state">Configure NEXT_PUBLIC_AGENT_URL to enable automation controls.</div>
              ) : isAgentLoading ? (
                <div className="empty-state">Loading automation status...</div>
              ) : (
                <div className="detail-grid">
                  <div className="detail-row">
                    <span>Executor</span>
                    <span>{agentStatusData?.executor || appConfig.agentExecutor || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Automation mode</span>
                    <span>{agentStatusData?.autoExecute ? "Auto + Approval" : "Manual Trigger"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Service health</span>
                    <span>{agentStatusData?.enabled === false ? "Disabled" : "Healthy"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Wallet configured</span>
                    <span>{agentStatusData?.walletConfigured ? "Yes" : "No"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Last cycle</span>
                    <span>{formatIsoDate(agentStatusData?.lastExecution?.executedAt || agentStatusData?.lastRunAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Cycle interval</span>
                    <span>{agentStatusData?.intervalMs ? `${Math.round(agentStatusData.intervalMs / 60000)} min` : "-"}</span>
                  </div>
                </div>
              )}
              <div className="mode-actions">
                <button className="btn btn-primary btn-small" type="button" onClick={handleRunAgent}>
                  Run now
                </button>
                <button className="btn btn-secondary btn-small" type="button" onClick={() => fetchAgentData()}>
                  Refresh data
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Signal Snapshot</h3>
              {!appConfig.agentUrl ? (
                <div className="empty-state">Agent endpoint unavailable.</div>
              ) : isAgentLoading ? (
                <div className="empty-state">Loading signal snapshot...</div>
              ) : !agentDecisionData ? (
                <div className="empty-state">No signal data yet.</div>
              ) : (
                <div className="detail-grid">
                  <div className="detail-row">
                    <span>Fear & Greed</span>
                    <span>
                      {typeof agentDecisionData.signals?.fearGreed === "number"
                        ? `${agentDecisionData.signals.fearGreed} (${agentDecisionData.signals.fearGreedLabel || "-"})`
                        : "-"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>HBAR 24h change</span>
                    <span>
                      {typeof agentDecisionData.signals?.hbarChange24hPct === "number"
                        ? `${agentDecisionData.signals.hbarChange24hPct.toFixed(2)}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>HBAR volatility</span>
                    <span>
                      {typeof agentDecisionData.signals?.hbarVolatility24hPct === "number"
                        ? `${agentDecisionData.signals.hbarVolatility24hPct.toFixed(2)}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Action</span>
                    <span>{agentDecisionData.action || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Selected strategy</span>
                    <span>{agentDecisionData.selectedStrategy?.name || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Target risk</span>
                    <span>{agentDecisionData.targetRisk || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span>Reason</span>
                    <span>{agentDecisionData.reason || "-"}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h3>Recent Runs</h3>
              {!appConfig.agentUrl ? (
                <div className="empty-state">No run history while agent endpoint is disabled.</div>
              ) : isAgentLoading ? (
                <div className="empty-state">Loading run history...</div>
              ) : (agentStatusData?.history || []).length === 0 ? (
                <div className="empty-state">No runs recorded yet.</div>
              ) : (
                <div className="activity">
                  {(agentStatusData?.history || []).slice(0, 6).map((item, index) => (
                    <div className="activity-item" key={`${item.at || "run"}-${index}`}>
                      <div style={{ fontWeight: 600 }}>
                        {item.executed ? "Executed" : "No execution"} • {item.action || "cycle"}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4 }}>
                        {formatIsoDate(item.at)}
                        {item.executor ? ` • ${item.executor}` : ""}
                        {item.reason ? ` • ${item.reason}` : ""}
                        {item.error ? ` • ${item.error}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3>Quick Protocol Actions</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Goal factory</span>
                  <span>{shortAddress(factoryAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>Prize pool</span>
                  <span>{shortAddress(appConfig.prizePoolAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>Agent endpoint</span>
                  <span className="detail-mono">{appConfig.agentUrl || "Not configured"}</span>
                </div>
              </div>
              <div className="mode-actions">
                <Link className="btn btn-secondary btn-small" href="/app/goals">
                  Open goals
                </Link>
                <button className="btn btn-primary btn-small" type="button" onClick={handleRunAgent}>
                  Trigger rebalance
                </button>
                {factoryExplorerUrl ? (
                  <a className="btn btn-secondary btn-small" href={factoryExplorerUrl} target="_blank" rel="noreferrer">
                    View factory
                  </a>
                ) : null}
                {prizePoolExplorerUrl ? (
                  <a className="btn btn-secondary btn-small" href={prizePoolExplorerUrl} target="_blank" rel="noreferrer">
                    View prize pool
                  </a>
                ) : null}
              </div>
            </div>

            {agentUiStatus.message ? <div className="status">{agentUiStatus.message}</div> : null}
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid settings-grid">
            <div className="card">
              <h3>Wallet & Network</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Connected wallet</span>
                  <span>{walletStatus}</span>
                </div>
                <div className="detail-row">
                  <span>Network</span>
                  <span>{appConfig.chainName}</span>
                </div>
                <div className="detail-row">
                  <span>Chain ID</span>
                  <span>{appConfig.chainId}</span>
                </div>
                <div className="detail-row">
                  <span>RPC URL</span>
                  <span className="detail-mono">{appConfig.rpcUrl}</span>
                </div>
                <div className="detail-row">
                  <span>Explorer</span>
                  <span className="detail-mono">{appConfig.explorerUrl}</span>
                </div>
              </div>
              <div className="mode-actions">
                {isConnected ? (
                  <button className="btn btn-secondary btn-small" type="button" onClick={() => disconnect()}>
                    Disconnect wallet
                  </button>
                ) : (
                  <button className="btn btn-primary btn-small" type="button" onClick={() => setIsConnectOpen(true)}>
                    Connect wallet
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3>Safety Defaults</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Default goal mode</span>
                  <span>Max Yield</span>
                </div>
                <div className="detail-row">
                  <span>Max risk cap</span>
                  <span>Medium</span>
                </div>
                <div className="detail-row">
                  <span>Large rebalance approval</span>
                  <span>Enabled</span>
                </div>
                <div className="detail-row">
                  <span>Emergency stop</span>
                  <span>Enabled</span>
                </div>
                <div className="detail-row">
                  <span>Agent execution mode</span>
                  <span>{agentStatusData?.autoExecute ? "Auto + Approval" : "Manual Trigger"}</span>
                </div>
              </div>
              <p className="goal-subtitle" style={{ marginTop: 12 }}>
                Use conservative defaults for prize mode and explicit strategy lock for higher-volatility routes.
              </p>
            </div>

            <div className="card">
              <h3>Notifications</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Run alerts</span>
                  <span>On</span>
                </div>
                <div className="detail-row">
                  <span>Failure alerts</span>
                  <span>On</span>
                </div>
                <div className="detail-row">
                  <span>Prize draw alerts</span>
                  <span>On</span>
                </div>
                <div className="detail-row">
                  <span>Weekly summary</span>
                  <span>Email + In-app</span>
                </div>
                <div className="detail-row">
                  <span>Delivery window</span>
                  <span>09:00 local time</span>
                </div>
              </div>
              <div className="mode-actions">
                <button className="btn btn-secondary btn-small" type="button">
                  Manage channels
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Data & Permissions</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Goal factory</span>
                  <span>{shortAddress(factoryAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>USDC token</span>
                  <span>{shortAddress(usdcAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>Prize pool</span>
                  <span>{shortAddress(appConfig.prizePoolAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>Agent URL</span>
                  <span className="detail-mono">{appConfig.agentUrl || "Not configured"}</span>
                </div>
                <div className="detail-row">
                  <span>Executor</span>
                  <span>{agentStatusData?.executor || appConfig.agentExecutor || "viem"}</span>
                </div>
                <div className="detail-row">
                  <span>Execute auth key</span>
                  <span>{appConfig.agentExecuteApiKey ? "Configured" : "Not set"}</span>
                </div>
              </div>
              <div className="mode-actions">
                <button className="btn btn-secondary btn-small" type="button" onClick={() => fetchAgentData()}>
                  Refresh permissions
                </button>
                {usdcExplorerUrl ? (
                  <a className="btn btn-secondary btn-small" href={usdcExplorerUrl} target="_blank" rel="noreferrer">
                    View USDC
                  </a>
                ) : null}
              </div>
            </div>

            {agentUiStatus.message ? <div className="status">{agentUiStatus.message}</div> : null}
          </section>
        ) : null}
      </main>

      {isConnectOpen ? (
        <div className="modal-backdrop" onClick={() => setIsConnectOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>Connect a wallet</span>
              <button className="btn btn-secondary" onClick={() => setIsConnectOpen(false)} type="button">
                Close
              </button>
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Choose a wallet provider. We will switch to {appConfig.chainName} automatically.
            </p>
            <div className="modal-list">
              {connectors.map((connector, index) => (
                <div className="modal-item" key={connector.uid}>
                  <span>{connector.name}</span>
                  <button className="btn btn-primary" type="button" onClick={() => handleConnect(index)}>
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isGoalModalOpen ? (
        <div className="modal-backdrop" onClick={closeGoalModal}>
          <div className="modal" style={{ width: "min(640px, 92vw)" }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>Create Goal (Step {goalCreateStep} of 3)</span>
              <button className="btn btn-secondary" onClick={closeGoalModal} type="button">
                Close
              </button>
            </div>
            <form className="form" onSubmit={(event) => event.preventDefault()}>
              {goalCreateStep === 1 ? (
                <>
                  <div className="mode-summary">
                    <span>1. Goal basics</span>
                    <strong>Define your savings objective first.</strong>
                  </div>

                  <div>
                    <label>Goal name</label>
                    <input type="text" value={goalName} onChange={(event) => setGoalName(event.target.value)} />
                  </div>

                  <div>
                    <label>Target amount (USDC)</label>
                    <input type="text" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} />
                  </div>

                  <div className="modal-actions goal-step-actions">
                    <button className="btn btn-secondary" type="button" onClick={closeGoalModal}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setGoalCreateStep(2)}
                      disabled={!hasGoalBasics}
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : null}

              {goalCreateStep === 2 ? (
                <>
                  <div className="mode-summary">
                    <span>2. Choose goal mode</span>
                    <strong>Mode is persisted on-chain with this goal.</strong>
                  </div>

                  <div className="mode-grid">
                    {goalModeOptions.map((option) => (
                      <button
                        key={option.id}
                        className={`mode-option ${goalModeDraft === option.id ? "active" : ""}`}
                        type="button"
                        onClick={() => setGoalModeDraft(option.id)}
                      >
                        <div className="mode-option-headline">
                          <strong>{option.label}</strong>
                          {option.isDefault ? <span className="goal-mode-default">Default (not recommended)</span> : null}
                        </div>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>

                  {goalModeDraft === "strategy-select" ? (
                    <div className="mode-block">
                      <label>Available yield strategies</label>
                      <select value={selectedStrategy} onChange={(event) => setSelectedStrategy(event.target.value)}>
                        {strategies.length === 0 ? (
                          <option value="">No strategies configured</option>
                        ) : (
                          strategies.map((strategy) => (
                            <option value={strategy.address} key={strategy.id}>
                              {strategy.name} ({(strategy.aprBps / 100).toFixed(2)}% APR)
                            </option>
                          ))
                        )}
                      </select>
                      <div className="detail-grid">
                        <div className="detail-row">
                          <span>Protocol</span>
                          <span>Bonzo / Hedera</span>
                        </div>
                        <div className="detail-row">
                          <span>Estimated APY</span>
                          <span>{selectedStrategyInfo ? `${(selectedStrategyInfo.aprBps / 100).toFixed(2)}%` : "-"}</span>
                        </div>
                        <div className="detail-row">
                          <span>Risk level</span>
                          <span>{getStrategyRiskLabel(selectedStrategyInfo?.aprBps)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Liquidity</span>
                          <span>High</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mode-summary">
                      <span>Strategy route</span>
                      <strong>
                        {goalModeDraft === "max-yield"
                          ? `Auto-route: ${draftModeStrategyLabel}`
                          : `Safety-route: ${draftModeStrategyLabel}`}
                      </strong>
                    </div>
                  )}

                  <div className="modal-actions goal-step-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setGoalCreateStep(1)}>
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setGoalCreateStep(3)}
                      disabled={!hasModeRoute || strategies.length === 0}
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : null}

              {goalCreateStep === 3 ? (
                <>
                  <div className="mode-summary">
                    <span>3. Review</span>
                    <strong>
                      {goalName || "New Goal"} · {GOAL_MODE_CONFIG[goalModeDraft].label} ·{" "}
                      {GOAL_MODE_CONFIG[goalModeDraft].engine}
                    </strong>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Goal target</span>
                      <span>{goalTarget || "0"} USDC</span>
                    </div>
                    <div className="detail-row">
                      <span>Mode strategy route</span>
                      <span>{draftModeStrategyLabel}</span>
                    </div>
                  </div>

                  <div className="modal-actions goal-step-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setGoalCreateStep(2)}>
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleCreateGoal}
                      disabled={!hasGoalBasics || !hasModeRoute || strategies.length === 0}
                    >
                      Create goal vault on-chain
                    </button>
                  </div>
                </>
              ) : null}

              {status.message ? <div className="status">{status.message}</div> : null}
            </form>
          </div>
        </div>
      ) : null}

      {isDepositModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsDepositModalOpen(false);
            setDepositGoal(null);
          }}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>Deposit to {depositGoal?.name || "goal"}</span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsDepositModalOpen(false);
                  setDepositGoal(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <form className="form" onSubmit={(event) => event.preventDefault()}>
              <div style={{ color: "var(--muted)" }}>
                Mode: {depositGoal ? GOAL_MODE_CONFIG[getGoalMode(depositGoal)].label : "-"}
              </div>
              <div style={{ color: "var(--muted)" }}>
                Strategy: {depositGoal ? getStrategyLabel(depositGoal.strategy) : "-"}
              </div>
              <div>
                <label>Amount (USDC)</label>
                <input type="text" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
              </div>
              <div className="input-row">
                <div>
                  <label>Allowance</label>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{allowanceFormatted} USDC</div>
                </div>
                <div>
                  <label>Balance</label>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{balanceFormatted} USDC</div>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" type="button" onClick={handleDeposit} disabled={!canDeposit}>
                  Deposit
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleApprove}>
                  Approve (one-time)
                </button>
              </div>
              {networkMismatch ? <div className="status">Switch to {appConfig.chainName} to continue.</div> : null}
              {status.message ? <div className="status">{status.message}</div> : null}
            </form>
          </div>
        </div>
      ) : null}

      {isWithdrawModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsWithdrawModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>Withdraw from {selectedGoal?.name || "goal"}</span>
              <button className="btn btn-secondary" onClick={() => setIsWithdrawModalOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="form" onSubmit={(event) => event.preventDefault()}>
              <div>
                <label>Amount (USDC)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary btn-small"
                    type="button"
                    onClick={() => setWithdrawAmount(maxWithdrawFormatted)}
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="input-row">
                <div>
                  <label>Available</label>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{maxWithdrawFormatted} USDC</div>
                </div>
                <div>
                  <label>Balance</label>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{balanceFormatted} USDC</div>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" type="button" onClick={handleWithdraw} disabled={!canWithdraw}>
                  Withdraw
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setIsWithdrawModalOpen(false)}>
                  Cancel
                </button>
              </div>
              {networkMismatch ? <div className="status">Switch to {appConfig.chainName} to continue.</div> : null}
              {status.message ? <div className="status">{status.message}</div> : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
