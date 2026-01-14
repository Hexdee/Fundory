"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "../lib/wagmi";
import { VaultProvider } from "../context/VaultContext";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <VaultProvider>{children}</VaultProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
