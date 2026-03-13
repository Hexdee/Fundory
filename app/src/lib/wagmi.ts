import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem";
import { appConfig } from "./config";

const mantleChain: Chain = {
  id: appConfig.chainId,
  name: appConfig.chainName,
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [appConfig.rpcUrl] },
    public: { http: [appConfig.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: appConfig.explorerUrl },
  },
};

const connectors = [
  injected({ shimDisconnect: true }),
  ...(appConfig.walletConnectProjectId
    ? [
        walletConnect({
          projectId: appConfig.walletConnectProjectId,
          metadata: {
            name: "Fundory",
            description: "Goal-based savings vaults with on-chain yield strategies.",
            url: "http://localhost:3000",
            icons: ["https://avatars.githubusercontent.com/u/37784886"],
          },
        }),
      ]
    : []),
];

export const config = createConfig({
  chains: [mantleChain],
  connectors,
  transports: {
    [mantleChain.id]: http(appConfig.rpcUrl),
  },
});
