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
  // inside a mobile wallet's browser (or any phone) take whatever the app injected
  return isMobile() || (e as { isInfra?: boolean }).isInfra ? e : undefined;
}

const scheme = process.env.NEXT_PUBLIC_INFRA_WALLET_SCHEME || "";

export const infraWallet = ({ projectId }: { projectId: string }): Wallet => {
  const injectedOk = Boolean(infraProvider());

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
    mobile: { getUri: (uri: string) => (scheme ? `${scheme}${encodeURIComponent(uri)}` : uri) },
    qrCode: !injectedOk
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
    // Decide AT CLICK TIME (in-app browsers may inject window.ethereum after our script loads):
    // injected provider if present, otherwise WalletConnect.
    createConnector: (details) =>
      createConnector((config) => {
        const inj = injected({
          target: () => ({ id: "infra-wallet", name: "INFRA Wallet", provider: infraProvider() as never }),
        })(config);
        const wc = walletConnect({
          projectId,
          showQrModal: false,
          metadata: {
            name: "INFRA Staking",
            description: "INFRA Dividend Pool staking",
            url: typeof window !== "undefined" ? window.location.origin : "https://dividend-staking-v2-0.vercel.app",
            icons: [],
          },
        })(config);
        let active: { connect: unknown } | null = null;
        const pick = () => active ?? (infraProvider() ? inj : wc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = (k: string, ...a: unknown[]): any => {
          const c = pick() as unknown as Record<string, (...x: unknown[]) => unknown>;
          return c[k]?.call(c, ...a);
        };
        return {
          ...wc,
          ...details,
          async setup() {
            await wc.setup?.();
          },
          async connect(p?: unknown) {
            const c = (infraProvider() ? inj : wc) as unknown as { connect: (x?: unknown) => Promise<never> };
            active = c;
            return c.connect.call(c, p);
          },
          async disconnect() {
            await call("disconnect");
            active = null;
          },
          getAccounts: () => call("getAccounts"),
          getChainId: () => call("getChainId"),
          getProvider: (p?: unknown) => call("getProvider", p),
          isAuthorized: () => call("isAuthorized"),
          switchChain: (p: unknown) => call("switchChain", p),
          onAccountsChanged: (a: unknown) => call("onAccountsChanged", a),
          onChainChanged: (c: unknown) => call("onChainChanged", c),
          onDisconnect: (e: unknown) => call("onDisconnect", e),
        } as typeof wc;
      }),
  };
};
