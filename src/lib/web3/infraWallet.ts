import type { Wallet } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

/**
 * INFRA Wallet — extension AND mobile app.
 *  - Desktop extension (Rabby-based): injected provider with `isRabby`.
 *  - Inside the INFRA Wallet app's dApp browser: injected `window.ethereum`.
 *  - Mobile browser / desktop without extension: WalletConnect. On a phone it deep-links to
 *    the app (NEXT_PUBLIC_INFRA_WALLET_SCHEME, e.g. "infrawallet://wc?uri="), else plain wc: link;
 *    on desktop it shows a QR code to scan with the app.
 */
type Eth = { isRabby?: boolean; isMetaMask?: boolean; providers?: Eth[] };

const isMobile = () => typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const eth = () => (typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eth }).ethereum);

/** Provider to use: Rabby/INFRA flag on desktop; any injected provider inside the mobile app. */
function infraProvider(): Eth | undefined {
  const e = eth();
  if (!e) return undefined;
  const list = e.providers?.length ? e.providers : [e];
  const flagged = list.find((p) => p.isRabby);
  if (flagged) return flagged;
  return isMobile() ? e : undefined;
}

const scheme = process.env.NEXT_PUBLIC_INFRA_WALLET_SCHEME || "";

export const infraWallet = ({ projectId }: { projectId: string }): Wallet => {
  const injectedOk = Boolean(infraProvider());
  const useWc = !injectedOk;

  return {
    id: "infra-wallet",
    name: "INFRA Wallet",
    iconUrl: "/infra-wallet.png",
    iconBackground: "#1F5BFF",
    // never `false`, so the entry is always listed (falls back to WalletConnect)
    installed: injectedOk || undefined,
    downloadUrls: {
      browserExtension: "https://infraworld.org/wallet",
      mobile: "https://infraworld.org/wallet",
      qrCode: "https://infraworld.org/wallet",
    },
    mobile: { getUri: useWc ? (uri: string) => (scheme ? `${scheme}${encodeURIComponent(uri)}` : uri) : undefined },
    qrCode: useWc
      ? {
          getUri: (uri: string) => uri,
          instructions: {
            learnMoreUrl: "https://infraworld.org/wallet",
            steps: [
              { step: "install", title: "Open the INFRA Wallet app", description: "Install INFRA Wallet on your phone." },
              { step: "create", title: "Create or import a wallet", description: "Never share your seed phrase." },
              { step: "scan", title: "Scan the QR code", description: "Use the scan button in INFRA Wallet to connect." },
            ],
          },
        }
      : undefined,
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
    createConnector: (details) =>
      createConnector((config) => ({
        ...(useWc
          ? walletConnect({ projectId, showQrModal: false, metadata: { name: "INFRA Staking", description: "INFRA Dividend Pool staking", url: typeof window !== "undefined" ? window.location.origin : "https://dividend-staking-v2-0.vercel.app", icons: [] } })(config)
          : injected({ target: () => ({ id: "infra-wallet", name: "INFRA Wallet", provider: infraProvider() as never }) })(config)),
        ...details,
      })),
  };
};
