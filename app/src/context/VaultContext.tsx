"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Address } from "viem";

type VaultContextValue = {
  selectedGoalId: bigint | null;
  selectedVault: Address | null;
  setSelectedGoalId: (id: bigint | null) => void;
  setSelectedVault: (vault: Address | null) => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [selectedGoalId, setSelectedGoalId] = useState<bigint | null>(null);
  const [selectedVault, setSelectedVault] = useState<Address | null>(null);

  const value = useMemo(
    () => ({ selectedGoalId, selectedVault, setSelectedGoalId, setSelectedVault }),
    [selectedGoalId, selectedVault]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVaultContext() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVaultContext must be used within VaultProvider");
  return ctx;
}
