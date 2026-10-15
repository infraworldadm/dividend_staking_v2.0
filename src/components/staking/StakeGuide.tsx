"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "lucide-react";

export type GuideTab = "earning" | "claim" | "stake";

export type GuideState =
  | { kind: "disconnected" }
  | { kind: "claim"; amount: string; deadline: string; countdown: string }
  | { kind: "earning"; amount: string; cycle: string; share: string }
  | { kind: "idle"; nextCycle: string; nextStart: string };

/** One clear "what should I do now" banner, based on the connected wallet's position. */
export function GuideBanner({ state, symbol, go }: { state: GuideState; symbol: string; go: (t: GuideTab) => void }) {
  if (state.kind === "disconnected") {
    return (
      <Banner tone="white" eyebrow="Get started" title="Connect your wallet to see where you stand"
        body="We’ll show whether you’re earning this month, have rewards to claim, or can stake for next month.">
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button className="btn btn-k btn-sm" onClick={openConnectModal}>
              Connect wallet <ArrowRight />
            </button>
          )}
        </ConnectButton.Custom>
      </Banner>
    );
  }
  if (state.kind === "claim") {
    return (
      <Banner tone="blue" eyebrow="Rewards ready" title={`${state.amount} ${symbol} to claim — before ${state.deadline}`}
        body={`The cycle has closed. Claim within the window or the rewards expire (${state.countdown} left).`}>
        <button className="btn btn-w btn-sm" onClick={() => go("claim")}>
          Claim now <ArrowRight />
        </button>
      </Banner>
    );
  }
  if (state.kind === "earning") {
    return (
      <Banner tone="dark" eyebrow={`Earning · ${state.cycle}`} title={`Your ${state.amount} ${symbol} is earning in the ${state.cycle} cycle`}
        body={`Your share of pool weight: ${state.share}. Rewards are your weight share of what the pool distributes — no fixed APR.`}>
        <button className="btn btn-w btn-sm" onClick={() => go("earning")}>
          View position <ArrowRight />
        </button>
      </Banner>
    );
  }
  return (
    <Banner tone="white" eyebrow={`Next cycle · ${state.nextCycle}`} title={`Stake now for ${state.nextCycle} rewards`}
      body={`Stakes made now join the next cycle, earning from ${state.nextStart}. Rewards are shared by weight.`}>
      <button className="btn btn-b btn-sm" onClick={() => go("stake")}>
        Stake for {state.nextCycle} <ArrowRight />
      </button>
    </Banner>
  );
}

function Banner({ tone, eyebrow, title, body, children }: {
  tone: "white" | "dark" | "blue"; eyebrow: string; title: string; body: string; children: ReactNode;
}) {
  return (
    <div className={`tile guide ${tone === "white" ? "" : tone}`}>
      <div className="grid min-w-0 gap-1.5">
        <span className={tone === "dark" ? "live" : `lbl ${tone === "white" ? "b" : ""}`}>
          <i /> {eyebrow}
        </span>
        <h2 className="text-[clamp(1.05rem,2vw,1.3rem)] font-semibold tracking-[-0.025em]">{title}</h2>
        <p className={`text-[0.84rem] ${tone === "white" ? "text-[var(--t2)]" : ""}`}>{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Tabs: who goes where. */
export function GuideTabs({ tab, setTab, labels, dots }: {
  tab: GuideTab; setTab: (t: GuideTab) => void; labels: Record<GuideTab, string>; dots: Partial<Record<GuideTab, boolean>>;
}) {
  const order: GuideTab[] = ["earning", "claim", "stake"];
  return (
    <div className="tabs" role="tablist">
      {order.map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
          {labels[t]}
          {dots[t] ? <i aria-label="action needed" /> : null}
        </button>
      ))}
    </div>
  );
}

/** "Earning now" panel for people who already staked. */
export function PositionPanel({ staked, symbol, cycle, progress, share, unlockIn, unlocked, totalClaimed }: {
  staked: string; symbol: string; cycle: string; progress: number; share: string; unlockIn: string;
  unlocked: boolean; totalClaimed: string;
}) {
  return (
    <div className="tile !gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="lbl b"><i /> Earning now · {cycle}</span>
        <span className="st st-active">Active</span>
      </div>
      <div>
        <div className="text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-none tracking-[-0.04em]">
          {staked}<span className="mono ml-2 text-[0.8rem] font-normal tracking-normal text-[var(--t3)]">{symbol} staked</span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="row"><span>{cycle} cycle progress</span><span className="mono text-[0.75rem]">{Math.floor(progress * 100)}%</span></div>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--field)]">
          <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-1.5 rounded-xl bg-[var(--field)] px-3.5 py-3">
        <div className="row"><span>Share of pool weight</span><span className="font-medium">{share}</span></div>
        <div className="row"><span>Lock</span><span className="font-medium">{unlocked ? "Unlocked" : `Unlocks in ${unlockIn}`}</span></div>
        <div className="row"><span>Total claimed</span><span className="font-medium">{totalClaimed} {symbol}</span></div>
      </div>
      <p className="note">
        No fixed APR. At cycle close you receive your weight share of what the pool distributes for that month.
      </p>
    </div>
  );
}

export function EmptyPanel({ label, title, body, cta, onCta }: {
  label: string; title: string; body: string; cta: string; onCta: () => void;
}) {
  return (
    <div className="tile !gap-3 items-start">
      <span className="lbl"><i /> {label}</span>
      <h3 className="text-[1.05rem] font-semibold">{title}</h3>
      <p className="text-[0.85rem] text-[var(--t2)]">{body}</p>
      <button className="btn btn-k btn-sm mt-1" onClick={onCta}>{cta} <ArrowRight /></button>
    </div>
  );
}
