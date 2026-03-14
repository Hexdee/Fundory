import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem";
import { appConfig } from "./config";

const appChain: Chain = {
  id: appConfig.chainId,
  name: appConfig.chainName,
  nativeCurrency: appConfig.nativeCurrency,
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
            description: "Goal-based savings with Bonzo vault interactions on Hedera.",
            url: "http://localhost:3000",
            icons: ["https://avatars.githubusercontent.com/u/37784886"],
          },
        }),
      ]
    : []),
];

export const config = createConfig({
  chains: [appChain],
  connectors,
  transports: {
    [appChain.id]: http(appConfig.rpcUrl),
  },
});
