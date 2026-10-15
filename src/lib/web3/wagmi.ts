import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { coinbaseWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { appChain } from "@/lib/web3/chains";
import { infraWallet } from "@/lib/web3/infraWallet";

export const wagmiConfig = getDefaultConfig({
  appName: "INFRA Staking",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [appChain],
  wallets: [
    { groupName: "Recommended", wallets: [infraWallet] },
    { groupName: "Other wallets", wallets: [metaMaskWallet, walletConnectWallet, coinbaseWallet] },
  ],
  ssr: true,
});
