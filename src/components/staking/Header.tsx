"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { appChain } from "@/lib/web3/chains";
import { formatToken } from "@/lib/format";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
  const { address, isConnected } = useAccount();
  const { data: infraBalance } = useBalance({
    address,
    chainId: appChain.id,
    query: { enabled: isConnected && Boolean(address) },
  });

  return (
    <div className="mb-5 flex items-center justify-between rounded-xl2 border border-borderSoft bg-cardBg px-5 py-4 shadow-card">
      <div className="text-2xl font-extrabold tracking-tight">
        <span className="border-b-4 border-black/90 leading-none">INFRA</span>
      </div>
      <ConnectButton.Custom>
        {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
          const connected = mounted && Boolean(account) && Boolean(chain);

          if (!connected) {
            return (
              <button
                onClick={openConnectModal}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                Connect Wallet
              </button>
            );
          }

          if (chain?.unsupported) {
            return (
              <button
                onClick={openChainModal}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Switch Network
              </button>
            );
          }

          const balance = formatToken(infraBalance?.value, 4);

          return (
            <button
              onClick={openAccountModal}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              {balance} ReAED | {shortAddress(account!.address)}
            </button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
