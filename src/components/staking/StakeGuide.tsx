"use client";

/**
 * @file Guidance UI: context banner (what to do now), tab switcher, positions list and empty states.
 */
import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "lucide-react";

export type GuideTab = "earning" | "claim" | "stake";

export type GuideState =
  | { kind: "disconnected" }
  | { kind: "notConfigured" }
  | { kind: "claim"; amount: string; deadline: string; countdown: string }
  | { kind: "grace"; amount: string; rewards: string; deadline: string; countdown: string; count: number }
  | { kind: "graceOver"; amount: string; count: number }
  | { kind: "earning"; amount: string; cycle: string; share: string; count: number }
  | { kind: "queued"; amount: string; cycle: string; start: string; count: number }
  | { kind: "idle"; nextCycle: string; nextStart: string; closesIn: string; running: string };

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
  if (state.kind === "notConfigured") {
    return (
      <Banner tone="white" eyebrow="Coming soon" title="The staking contract is being deployed"
        body="Staking opens as soon as the new monthly pool contract is live. You can explore how it works in the meantime.">
        <span />
      </Banner>
    );
  }
  if (state.kind === "claim") {
    return (
      <Banner tone="blue" eyebrow="Rewards ready" title={`${state.amount} ${symbol} to claim — before ${state.deadline}`}
        body={`The cycle has closed. Claim within the window (${state.countdown} left); after that the rewards are forfeited.`}>
        <button className="btn btn-w btn-sm" onClick={() => go("claim")}>
          Claim now <ArrowRight />
        </button>
      </Banner>
    );
  }
  if (state.kind === "grace") {
    return (
      <Banner tone="blue" eyebrow="Lock ended · grace period" title={`Withdraw ${state.amount} ${symbol}${state.rewards !== "0.00" ? ` + ${state.rewards} rewards` : ""} before ${state.deadline}`}
        body={`${state.count > 1 ? `${state.count} of your positions have` : "Your position has"} stopped earning. Withdraw within the grace period (${state.countdown} left) to receive your rewards too — after that, only your principal is returned.`}>
        <button className="btn btn-w btn-sm" onClick={() => go("earning")}>
          View my stakes <ArrowRight />
        </button>
      </Banner>
    );
  }
  if (state.kind === "graceOver") {
    return (
      <Banner tone="dark" eyebrow="Grace period over" title={`Withdraw your ${state.amount} ${symbol} principal${state.count > 1 ? ` (${state.count} positions)` : ""}`}
        body="The 30-day window to collect rewards has passed, so those rewards were forfeited. Your principal is safe — withdraw it any time.">
        <button className="btn btn-w btn-sm" onClick={() => go("earning")}>
          View my stakes <ArrowRight />
        </button>
      </Banner>
    );
  }
  if (state.kind === "earning") {
    return (
      <Banner tone="dark" eyebrow={`Earning · ${state.cycle}`} title={`Your ${state.amount} ${symbol} is earning in the ${state.cycle} cycle`}
        body={`${state.count > 1 ? `${state.count} positions · ` : ""}Your share this month: ${state.share}. No fixed APR — you get your share of what the dividend pool sends at month end. You can add more stakes for next month anytime.`}>
        <button className="btn btn-w btn-sm" onClick={() => go("earning")}>
          View my stakes <ArrowRight />
        </button>
      </Banner>
    );
  }
  if (state.kind === "queued") {
    return (
      <Banner tone="white" eyebrow={`Starts · ${state.cycle}`} title={`Your ${state.amount} ${symbol} starts earning on ${state.start}`}
        body={`Stakes join the next monthly cycle. From ${state.start} you earn a share of the ${state.cycle} reward pool.`}>
        <button className="btn btn-k btn-sm" onClick={() => go("earning")}>
          View my stakes <ArrowRight />
        </button>
      </Banner>
    );
  }
  return (
    <Banner tone="white" eyebrow={`Staking open · closes in ${state.closesIn}`} title={`Stake now for ${state.nextCycle} rewards`}
      body={`${state.running} is already running and closed to new stakes. Stake before it ends to earn a full share of ${state.nextCycle}, starting ${state.nextStart}.`}>
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
    <div className={`tile guide ${tone === "white" ? "" : tone}`} key={eyebrow}>
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

export type PositionStatus = "queued" | "earning" | "grace" | "graceOver";

const STATUS_CHIP: Record<PositionStatus, { text: string; cls: string }> = {
  queued: { text: "Starts next month", cls: "st-next" },
  earning: { text: "Earning", cls: "st-active" },
  grace: { text: "Lock ended · grace", cls: "st-claim" },
  graceOver: { text: "Grace over", cls: "st-closed" },
};

export type PositionView = {
  id: bigint;
  status: PositionStatus;
  amount: string;
  months: string;
  lockEnd: string;
  graceEnd: string;
  graceCountdown: string;
  lockCountdown: string;
  claimable: string;
  /** for multi-month positions: e.g. "Nov reward: claim 1 Dec → 31 Dec" */
  nextClaim?: string;
};

/** "My stakes": totals + one card per open position, each with its own withdraw. */
export function PositionsPanel(p: {
  symbol: string;
  totalStaked: string;
  count: number;
  cycle: string;
  progress: number;
  share: string;
  estimate: string;
  totalClaimed: string;
  totalExpired: string;
  endedCount: number;
  positions: PositionView[];
  onWithdraw: (id: bigint) => void;
  onWithdrawAll: () => void;
  onAdd: () => void;
  busy: boolean;
  error: string | null;
}) {
  const earning = p.positions.some((x) => x.status === "earning");
  return (
    <>
      <div className="tile !gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="lbl b"><i /> My stakes · {p.count} {p.count === 1 ? "position" : "positions"}</span>
          <button className="text-[0.82rem] font-medium text-[var(--blue)] hover:underline" onClick={p.onAdd}>+ Add a stake</button>
        </div>
        <div className="text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-none tracking-[-0.04em]">
          {p.totalStaked}<span className="mono ml-2 text-[0.8rem] font-normal tracking-normal text-[var(--t3)]">{p.symbol} staked</span>
        </div>
        {earning ? (
          <div className="grid gap-1.5">
            <div className="row"><span>{p.cycle} progress</span><span className="mono text-[0.75rem]">{Math.floor(p.progress * 100)}%</span></div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--field)]">
              <div className="bar-fill grow h-full rounded-full bg-[var(--blue)]" style={{ width: `${p.progress * 100}%` }} />
            </div>
          </div>
        ) : null}
        <div className="grid gap-1.5 rounded-xl bg-[var(--field)] px-3.5 py-3">
          {earning ? (
            <>
              <div className="row"><span>Your share this month</span><span className="font-medium">{p.share}</span></div>
              <div className="row"><span>If distributed now</span><span className="font-medium">≈ {p.estimate} {p.symbol}</span></div>
            </>
          ) : null}
          <div className="row"><span>Claimed to date</span><span className="font-medium">{p.totalClaimed} {p.symbol}</span></div>
          {p.totalExpired !== "0.00" ? (
            <div className="row"><span>Forfeited (not claimed in time)</span><span className="font-medium">{p.totalExpired} {p.symbol}</span></div>
          ) : null}
        </div>
        {p.endedCount > 1 ? (
          <button className="btn btn-b w-full" onClick={p.onWithdrawAll} disabled={p.busy}>
            {p.busy ? "Processing…" : `Withdraw all ${p.endedCount} ended positions`}
          </button>
        ) : null}
        {p.error ? <p className="err !-mt-1 text-center !text-[var(--t2)]">{p.error}</p> : null}
      </div>

      {p.positions.map((x, n) => {
        const chip = STATUS_CHIP[x.status];
        const ended = x.status === "grace" || x.status === "graceOver";
        return (
          <div className="tile pos !gap-2.5" key={String(x.id)}>
            <div className="flex items-center justify-between gap-3">
              <span className="lbl"><i /> Position {n + 1}</span>
              <span className={`st ${chip.cls}`}>{chip.text}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                {x.amount}<span className="mono ml-1.5 text-[0.75rem] font-normal tracking-normal text-[var(--t3)]">{p.symbol}</span>
              </div>
              <span className="mono text-[0.75rem] text-[var(--t2)]">{x.months}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.8rem]">
              <div className="grid"><span className="text-[var(--t3)]">Lock ends</span><span className="font-medium">{x.lockEnd}</span></div>
              <div className="grid"><span className="text-[var(--t3)]">Withdraw with rewards by</span><span className="font-medium">{x.graceEnd}</span></div>
            </div>
            {x.nextClaim && !ended ? (
              <div className="claimnote">
                <span className="st st-claim">Claim monthly</span>
                <span>{x.nextClaim}</span>
              </div>
            ) : null}
            {ended ? (
              <button className="btn btn-b btn-sm w-full" onClick={() => p.onWithdraw(x.id)} disabled={p.busy}>
                {p.busy
                  ? "Processing…"
                  : x.status === "grace" && x.claimable !== "0.00"
                    ? `Withdraw ${x.amount} + ${x.claimable} rewards`
                    : `Withdraw ${x.amount} ${p.symbol}`}
              </button>
            ) : (
              <div className="mono text-[0.72rem] text-[var(--t3)]">
                {x.status === "queued" ? "Starts earning next month" : `Unlocks in ${x.lockCountdown}`}
              </div>
            )}
            {x.status === "grace" ? (
              <p className="note">Grace ends in {x.graceCountdown} — after that, only the principal is returned.</p>
            ) : null}
          </div>
        );
      })}
    </>
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
