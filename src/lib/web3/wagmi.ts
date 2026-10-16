/**
 * @file wagmi + RainbowKit configuration: chain, wallet list (INFRA Wallet first) and WalletConnect project id.
 */
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { appChain } from "@/lib/web3/chains";
import { infraWallet } from "@/lib/web3/infraWallet";

export const wagmiConfig = getDefaultConfig({
  appName: "INFRA Staking",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [appChain],
  wallets: [
    { groupName: "Recommended", wallets: [infraWallet] },
    { groupName: "Other wallets", wallets: [metaMaskWallet, trustWallet, walletConnectWallet, coinbaseWallet] },
  ],
  // Turn off EIP-6963 auto-listing: INFRA Wallet shares Rabby's rdns (io.rabby), so
  // auto-discovery would replace our branded entry with "Rabby Wallet".
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
