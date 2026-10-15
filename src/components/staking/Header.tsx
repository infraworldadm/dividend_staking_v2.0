"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { ArrowRight } from "lucide-react";
import { appChain } from "@/lib/web3/chains";
import { formatToken } from "@/lib/format";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Header({ onTour }: { onTour?: () => void }) {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    chainId: appChain.id,
    query: { enabled: isConnected && Boolean(address) },
  });
  const explorer = appChain.blockExplorers?.default.url;

  return (
    <header className="nav">
      <div className="wrap flex h-16 items-center gap-5">
        <a href="https://infraworld.org" className="flex items-center gap-3" aria-label="INFRA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo/infra-logo-light.svg" alt="INFRA" width={86} height={26} className="h-[26px] w-auto" />
          <span className="lbl hidden sm:inline-flex">/ Staking</span>
        </a>

        <nav className="ml-auto hidden items-center gap-6 text-[0.88rem] text-[var(--t2)] md:flex">
          {onTour ? (
            <button onClick={onTour} className="transition-colors hover:text-[var(--t1)]">
              How it works
            </button>
          ) : null}
          <a href="https://infraworld.org" className="transition-colors hover:text-[var(--t1)]">Website</a>
          {explorer ? (
            <a href={explorer} target="_blank" rel="noreferrer" className="transition-colors hover:text-[var(--t1)]">
              Explorer
            </a>
          ) : null}
        </nav>

        <div className="ml-auto md:ml-0">
          <ConnectButton.Custom>
            {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
              const connected = mounted && Boolean(account) && Boolean(chain);

              if (!connected) {
                return (
                  <button onClick={openConnectModal} className="btn btn-k btn-sm">
                    Connect wallet <ArrowRight />
                  </button>
                );
              }

              if (chain?.unsupported) {
                return (
                  <button onClick={openChainModal} className="btn btn-b btn-sm">
                    Switch to {appChain.name}
                  </button>
                );
              }

              return (
                <button onClick={openAccountModal} className="btn btn-k btn-sm gap-3">
                  <span className="mono hidden text-[0.8rem] text-white/60 sm:inline">
                    {formatToken(balance?.value, 2)} reAED
                  </span>
                  <span className="mono text-[0.8rem]">{shortAddress(account!.address)}</span>
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
}
