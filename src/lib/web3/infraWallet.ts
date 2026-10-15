import type { Wallet } from "@rainbow-me/rainbowkit";
import { rabbyWallet } from "@rainbow-me/rainbowkit/wallets";

/**
 * INFRA Wallet browser extension.
 * It is built on Rabby: it injects `window.ethereum` with `isRabby` and announces
 * itself over EIP-6963 as "INFRA Wallet" with rdns `io.rabby`, so we reuse
 * Rabby's injected connector under INFRA branding.
 */
export const infraWallet = (): Wallet => {
  const rabby = rabbyWallet();
  return {
    ...rabby,
    id: "infra-wallet",
    name: "INFRA Wallet",
    iconUrl: "/infra-wallet.png",
    iconBackground: "#1F5BFF",
    downloadUrls: {
      browserExtension: "https://infraworld.org/wallet",
    },
    extension: {
      instructions: {
        learnMoreUrl: "https://infraworld.org/wallet",
        steps: [
          { step: "install", title: "Install INFRA Wallet", description: "Add the INFRA Wallet extension to your browser." },
          { step: "create", title: "Create or import a wallet", description: "Set up a new wallet or import an existing one. Never share your seed phrase." },
          { step: "refresh", title: "Refresh this page", description: "Reload the page so INFRA Wallet can connect." },
        ],
      },
    },
  };
};
