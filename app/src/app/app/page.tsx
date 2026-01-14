"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const initialStatus: StatusState = { message: "", kind: "idle" };

export default function AppPage() {
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
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<GoalInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isGoalsLoading, setIsGoalsLoading] = useState(false);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [activeView, setActiveView] = useState<
    "dashboard" | "goals" | "deposits" | "yield" | "settings"
  >("dashboard");

  const factoryAddress = appConfig.factoryAddress;
  const usdcAddress = appConfig.usdcAddress;
  const strategies = appConfig.strategies;

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

            const [owner, vault, name, targetAmount, strategy, createdAt] = result as [
              string,
              string,
              string,
              bigint,
              string,
              bigint,
            ];

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
              createdAt,
              assets,
            } as GoalInfo;
          })
        );

        setGoals(fetched);
        if (!selectedGoalId && fetched.length > 0) {
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
  const totalSaved = useMemo(() => {
    return goals.reduce((acc, goal) => acc + (goal.assets || 0n), 0n);
  }, [goals]);
  const assetsFormatted = formatAmount(totalSaved, appConfig.usdcDecimals);
  const ppsFormatted = formatAmount(pricePerShare, 18);

  const resetStatus = () => setStatus(initialStatus);

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

  const strategyMap = useMemo(() => {
    return new Map(
      strategies.map((strategy) => [strategy.address.toLowerCase(), strategy])
    );
  }, [strategies]);

  const getStrategyLabel = (strategyAddress?: string) => {
    if (!strategyAddress) return "Unknown strategy";
    const info = strategyMap.get(strategyAddress.toLowerCase());
    if (!info) return `${strategyAddress.slice(0, 6)}...${strategyAddress.slice(-4)}`;
    return `${info.name} (${(info.aprBps / 100).toFixed(2)}% APR)`;
  };

  const detailTarget = selectedGoal
    ? formatAmount(selectedGoal.targetAmount, appConfig.usdcDecimals)
    : "0.00";
  const detailSaved = selectedGoal
    ? formatAmount(selectedGoal.assets, appConfig.usdcDecimals)
    : "0.00";
  const detailProgress = formatProgress(selectedGoal?.assets, selectedGoal?.targetAmount);
  const createdDate = selectedGoal?.createdAt
    ? new Date(Number(selectedGoal.createdAt) * 1000).toLocaleDateString()
    : "-";
  const selectedStrategyLabel = selectedGoal ? getStrategyLabel(selectedGoal.strategy) : "-";

  const shortAddress = (value?: string) => {
    if (!value) return "-";
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "Just now";
    return new Date(ts * 1000).toLocaleString();
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
    } catch (err: any) {
      setStatus({ message: err?.shortMessage || err?.message || "Connect failed.", kind: "error" });
    }
  };

  const ensureNetwork = async () => {
    if (!isConnected) return;
    if (chain?.id === appConfig.chainId) return;
    try {
      await switchChainAsync({ chainId: appConfig.chainId });
      return;
    } catch (err: any) {
      const ethereum = (window as any)?.ethereum;
      if (!ethereum?.request) throw err;
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: appConfig.chainIdHex }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
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
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedStrategy && strategies.length > 0) {
      setSelectedStrategy(strategies[0].address);
    }
  }, [selectedStrategy, strategies]);

  useEffect(() => {
    if (!isConnected) return;
    ensureNetwork().catch((err) => {
      console.error(err);
      setStatus({ message: "Please switch to the configured network.", kind: "error" });
    });
  }, [isConnected, chain?.id]);

  const handleCreateGoal = async () => {
    if (!factoryAddress || !goalName || !goalTarget || !selectedStrategy) {
      setStatus({ message: "Set a goal name, target, and strategy.", kind: "error" });
      return;
    }
    if (!isAddress(selectedStrategy)) {
      setStatus({ message: "Select a valid strategy.", kind: "error" });
      return;
    }
    try {
      setStatus({ message: "Creating goal vault...", kind: "loading" });
      const target = parseUnits(goalTarget, appConfig.usdcDecimals);
      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "createGoal",
        args: [goalName, target, getAddress(selectedStrategy)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      const refreshed = await refetchGoals();
      await loadGoals(refreshed.data as readonly bigint[] | undefined);
      setGoalName("");
      setGoalTarget("");
      setStatus({ message: "Goal created.", kind: "success" });
      setIsGoalModalOpen(false);
    } catch (err: any) {
      setStatus({ message: err?.shortMessage || err?.message || "Goal creation failed.", kind: "error" });
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
    } catch (err: any) {
      setStatus({ message: err?.shortMessage || err?.message || "Approval failed.", kind: "error" });
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
    } catch (err: any) {
      setStatus({ message: err?.shortMessage || err?.message || "Deposit failed.", kind: "error" });
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
    } catch (err: any) {
      setStatus({ message: err?.shortMessage || err?.message || "Withdrawal failed.", kind: "error" });
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

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Indexer error");
      const data = (await res.json()) as { activities: Array<Omit<ActivityItem, "amount"> & { amount: string }> };
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

  const walletStatus = mounted
    ? isConnected && address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "Not connected"
    : "...";
  const chainLabel = mounted ? (chain?.name || appConfig.chainName) : appConfig.chainName;
  const networkMismatch = mounted && isConnected && chain?.id !== appConfig.chainId;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-badge" src="/fundory-logo.svg" alt="Fundory logo" />
          Fundory
        </div>
        <nav>
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "goals", label: "Goals" },
            { id: "deposits", label: "Deposits" },
            { id: "yield", label: "Yield" },
            { id: "settings", label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeView === item.id ? "active" : ""}`}
              type="button"
              onClick={() => setActiveView(item.id as typeof activeView)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="vault-summary">
          <h4>Total saved</h4>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>${assetsFormatted}</p>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            {goals.length} goals tracked
          </p>
        </div>
        <div className="vault-summary">
          <span className="tag">On-chain deposits</span>
          <p style={{ margin: "12px 0 0", color: "var(--muted)" }}>
            Deposits confirm in your wallet.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/">
          Back to landing
        </Link>
      </aside>

      <main>
        <header className="topbar" style={{ height: 72.5 }}>
          <div>
            <h2>Fundory dashboard</h2>
            <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
              Connect, create a goal, and deposit on-chain.
            </p>
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

        {activeView === "dashboard" || activeView === "goals" ? (
          <section className="grid-split">
            <div className="card">
              <div className="card-header">
                <h3>Active goals</h3>
                <button
                  className="btn btn-secondary btn-small btn-icon"
                  type="button"
                  onClick={() => {
                    resetStatus();
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
                  <div className="empty-state">
                    No goals yet. Create your first goal to start saving.
                  </div>
                )
              ) : (
                <div className="goals-list">
                  {goals.map((goal) => {
                    const saved = formatAmount(goal.assets, appConfig.usdcDecimals);
                    const targetFormatted = formatAmount(goal.targetAmount, appConfig.usdcDecimals);
                    const progress = formatProgress(goal.assets, goal.targetAmount);
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
                        <div className="progress-track" style={{ "--progress": progress } as any}>
                          <span />
                        </div>
                        <div className="goal-subtitle">
                          {progress} complete • {getStrategyLabel(goal.strategy)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Goal detail</h3>
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
              <p style={{ fontWeight: 600 }}>{selectedGoal?.name || "Select a goal"}</p>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Vault</span>
                  <span>{activeVault ? `${activeVault.slice(0, 6)}...` : "-"}</span>
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
                <div className="detail-row">
                  <span>Est. yield (PPS)</span>
                  <span
                    title={`$${formatUnits(estimatedYield, appConfig.usdcDecimals)}`}
                    style={{ cursor: "help" }}
                  >
                    ${estimatedYieldFormatted}
                  </span>
                </div>
              </div>
              <div className="goal" style={{ paddingTop: 8 }}>
                <div className="progress-track" style={{ "--progress": detailProgress } as any}>
                  <span />
                </div>
                <div className="goal-subtitle">{detailProgress} complete</div>
              </div>
              <p style={{ color: "var(--muted)", margin: "12px 0" }}>
                Saved: ${detailSaved} of ${detailTarget} - PPS: {ppsFormatted}
              </p>
            </div>
          </section>
        ) : null}

        {activeView === "dashboard" ? (
          <section className="grid">
            <div className="card">
              <h3>Yield engine</h3>
              <p style={{ color: "var(--muted)" }}>
                Mock strategies accrue yield on-chain with fixed APR. Pick one when creating a goal to
                simulate different risk profiles.
              </p>
              {strategies.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 12 }}>
                  No strategies configured yet. Deploy mock strategies and add their addresses.
                </div>
              ) : (
                <div className="strategy-list">
                  {strategies.map((strategy) => (
                    <div className="strategy-card" key={strategy.id}>
                      <div style={{ fontWeight: 600 }}>{strategy.name}</div>
                      <div className="goal-subtitle">
                        {(strategy.aprBps / 100).toFixed(2)}% APR
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3>Recent activity</h3>
              {isActivitiesLoading ? (
                <div className="empty-state">Loading activity...</div>
              ) : activities.length === 0 ? (
                <div className="empty-state">No activity yet.</div>
              ) : (
                <div className="activity">
                  {activities.map((item) => (
                    <div className="activity-item" key={item.id}>
                      <div style={{ fontWeight: 600 }}>
                        {item.type} +${formatAmount(item.amount, appConfig.usdcDecimals)}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4 }}>
                        {item.goalName || shortAddress(item.vault)} - {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "deposits" ? (
          <section className="grid">
            <div className="card">
              <h3>Quick deposit</h3>
              {selectedGoal ? (
                <>
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Goal</span>
                      <span>{selectedGoal.name}</span>
                    </div>
                    <div className="detail-row">
                      <span>Target</span>
                      <span>${detailTarget}</span>
                    </div>
                    <div className="detail-row">
                      <span>Saved</span>
                      <span>${detailSaved}</span>
                    </div>
                    <div className="detail-row">
                      <span>Strategy</span>
                      <span className="detail-strategy">{selectedStrategyLabel}</span>
                    </div>
                    <div className="detail-row">
                      <span>Allowance</span>
                      <span>{allowanceFormatted} USDC</span>
                    </div>
                    <div className="detail-row">
                      <span>Wallet balance</span>
                      <span>{balanceFormatted} USDC</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    style={{ marginTop: 16 }}
                    onClick={() => {
                      resetStatus();
                      setDepositGoal(selectedGoal);
                      setIsDepositModalOpen(true);
                    }}
                  >
                    Deposit to {selectedGoal.name}
                  </button>
                  {networkMismatch ? (
                    <div className="status">Switch to {appConfig.chainName} to continue.</div>
                  ) : null}
                </>
              ) : (
                <div className="empty-state">Select a goal to deposit.</div>
              )}
            </div>

            <div className="card">
              <h3>Recent activity</h3>
              {isActivitiesLoading ? (
                <div className="empty-state">Loading activity...</div>
              ) : activities.length === 0 ? (
                <div className="empty-state">No activity yet.</div>
              ) : (
                <div className="activity">
                  {activities.map((item) => (
                    <div className="activity-item" key={item.id}>
                      <div style={{ fontWeight: 600 }}>
                        {item.type} +${formatAmount(item.amount, appConfig.usdcDecimals)}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4 }}>
                        {item.goalName || shortAddress(item.vault)} - {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "yield" ? (
          <section className="grid">
            <div className="card">
              <h3>Yield engine</h3>
              <p style={{ color: "var(--muted)" }}>
                Mock strategies accrue yield on-chain with fixed APR. Pick one when creating a goal to
                simulate different risk profiles.
              </p>
              {strategies.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 12 }}>
                  No strategies configured yet. Deploy mock strategies and add their addresses.
                </div>
              ) : (
                <div className="strategy-list">
                  {strategies.map((strategy) => (
                    <div className="strategy-card" key={strategy.id}>
                      <div style={{ fontWeight: 600 }}>{strategy.name}</div>
                      <div className="goal-subtitle">
                        {(strategy.aprBps / 100).toFixed(2)}% APR
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <h3>Goal strategies</h3>
              {goals.length === 0 ? (
                <div className="empty-state">No goals yet.</div>
              ) : (
                <div className="strategy-list">
                  {goals.map((goal) => (
                    <div className="strategy-card" key={goal.id.toString()}>
                      <div style={{ fontWeight: 600 }}>{goal.name}</div>
                      <div className="goal-subtitle">{getStrategyLabel(goal.strategy)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid">
            <div className="card">
              <h3>Network</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Chain</span>
                  <span>{appConfig.chainName}</span>
                </div>
                <div className="detail-row">
                  <span>Chain ID</span>
                  <span>{appConfig.chainId}</span>
                </div>
                <div className="detail-row">
                  <span>RPC</span>
                  <span className="detail-mono">{appConfig.rpcUrl}</span>
                </div>
                <div className="detail-row">
                  <span>Explorer</span>
                  <span className="detail-mono">{appConfig.explorerUrl}</span>
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Contracts</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span>Factory</span>
                  <span>{shortAddress(factoryAddress)}</span>
                </div>
                <div className="detail-row">
                  <span>USDC</span>
                  <span>{shortAddress(usdcAddress)}</span>
                </div>
                {strategies.map((strategy) => (
                  <div className="detail-row" key={strategy.id}>
                    <span>{strategy.name}</span>
                    <span>{shortAddress(strategy.address)}</span>
                  </div>
                ))}
              </div>
            </div>
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
        <div className="modal-backdrop" onClick={() => setIsGoalModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span>Create a new goal</span>
              <button className="btn btn-secondary" onClick={() => setIsGoalModalOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="form" onSubmit={(event) => event.preventDefault()}>
              <div>
                <label>Goal name</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(event) => setGoalName(event.target.value)}
                />
              </div>
              <div>
                <label>Target amount (USDC)</label>
                <input
                  type="text"
                  value={goalTarget}
                  onChange={(event) => setGoalTarget(event.target.value)}
                />
              </div>
              <div>
                <label>Strategy</label>
                <select
                  value={selectedStrategy}
                  onChange={(event) => setSelectedStrategy(event.target.value)}
                >
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
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleCreateGoal}
                disabled={!selectedStrategy || strategies.length === 0}
              >
                Create goal vault
              </button>
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
                Strategy: {depositGoal ? getStrategyLabel(depositGoal.strategy) : "-"}
              </div>
              <div>
                <label>Amount (USDC)</label>
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                />
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
              {networkMismatch ? (
                <div className="status">Switch to {appConfig.chainName} to continue.</div>
              ) : null}
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
              <button
                className="btn btn-secondary"
                onClick={() => setIsWithdrawModalOpen(false)}
                type="button"
              >
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
              {networkMismatch ? (
                <div className="status">Switch to {appConfig.chainName} to continue.</div>
              ) : null}
              {status.message ? <div className="status">{status.message}</div> : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
