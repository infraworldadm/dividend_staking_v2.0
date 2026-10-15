import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { appChain } from "@/lib/web3/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "INFRA Staking",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [appChain],
  ssr: true,
});
