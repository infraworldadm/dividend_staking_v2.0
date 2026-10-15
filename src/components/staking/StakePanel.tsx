"use client";

import { cyclesAround, fmtDate } from "@/lib/cycles";

type StakePanelProps = {
  mode: "stake" | "withdraw";
  setMode: (mode: "stake" | "withdraw") => void;
  amount: string;
  setAmount: (value: string) => void;
  periods: number;
  setPeriods: (value: number) => void;
  walletBalance: string;
  walletBalanceRaw: string;
  stakedAmount: string;
  weightMetricLabel: string;
  weightMetricValue: string;
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  onStake: () => void;
  onWithdraw: () => void;
  isStakeDisabled: boolean;
  stakeDisabledReason: string | null;
  isWithdrawDisabled: boolean;
  withdrawDisabledReason: string | null;
  busy: boolean;
  symbol: string;
  /** Hide the Stake/Unstake switch (mode is driven by the page tabs). */
  lockMode?: boolean;
  title?: string;
};

export function StakePanel({
  mode,
  setMode,
  amount,
  setAmount,
  periods,
  setPeriods,
  walletBalance,
  walletBalanceRaw,
  stakedAmount,
  weightMetricLabel,
  weightMetricValue,
  termsAccepted,
  setTermsAccepted,
  onStake,
  onWithdraw,
  isStakeDisabled,
  stakeDisabledReason,
  isWithdrawDisabled,
  withdrawDisabledReason,
  busy,
  symbol,
  lockMode,
  title,
}: StakePanelProps) {
  const inStakeMode = mode === "stake";
  const unlockDate = new Date(Date.now() + periods * 30 * 86400 * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const nextCycle = cyclesAround(Math.floor(Date.now() / 1000)).next;
  const reason = inStakeMode ? stakeDisabledReason : withdrawDisabledReason;

  return (
    <div className="tile !gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="lbl b">
          <i /> {title || "INFRA Real Yield"}
        </span>
        <span className="mono text-[0.72rem] text-[var(--t3)]">Wallet · {walletBalance} {symbol}</span>
      </div>

      {lockMode ? null : (
      <div className="seg" role="group" aria-label="Action">
        <button aria-pressed={inStakeMode} onClick={() => setMode("stake")}>
          Stake
        </button>
        <button aria-pressed={!inStakeMode} onClick={() => setMode("withdraw")}>
          Unstake
        </button>
      </div>
      )}

      {inStakeMode ? (
        <>
          <div className="grid min-w-0 gap-2">
            <label htmlFor="amount" className="text-[0.85rem] text-[var(--t2)]">
              Amount
            </label>
            <div className="field">
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
              />
              <span className="mono text-[0.8rem] text-[var(--t3)]">{symbol}</span>
              <button onClick={() => setAmount(walletBalanceRaw)} className="btn btn-k !h-7 !rounded-lg !px-3 !text-[0.75rem]">
                Max
              </button>
            </div>
          </div>

          <div className="grid min-w-0 gap-2">
            <div className="row">
              <span>Lock period</span>
              <span className="mono text-[0.75rem] text-[var(--t3)]">30 days each</span>
            </div>
            <div className="chips">
              {[1, 2, 3, 6, 12].map((p) => (
                <button key={p} aria-pressed={periods === p} onClick={() => setPeriods(p)}>
                  {p * 30}d
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 rounded-xl bg-[var(--field)] px-3.5 py-3">
            <div className="row">
              <span>Joins cycle</span>
              <span className="font-medium">
                {nextCycle.label} · from {fmtDate(nextCycle.start)}
              </span>
            </div>
            <div className="row">
              <span>Unlocks on</span>
              <span className="font-medium">{unlockDate}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid min-w-0 gap-2">
            <span className="text-[0.85rem] text-[var(--t2)]">Staked principal</span>
            <div className="field">
              <span className="flex-1 text-[1.4rem] font-semibold tracking-[-0.03em]">{stakedAmount}</span>
              <span className="mono text-[0.8rem] text-[var(--t3)]">{symbol}</span>
            </div>
            <span className="text-[0.78rem] text-[var(--t3)]">Withdraw returns your full principal after the lock ends.</span>
          </div>
          <div className="grid gap-1.5 rounded-xl bg-[var(--field)] px-3.5 py-3">
            <div className="row">
              <span>{weightMetricLabel}</span>
              <span className="font-medium">{weightMetricValue}</span>
            </div>
          </div>
        </>
      )}

      <label className="check">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        <span>I accept the terms of service and the pool&apos;s distribution policy.</span>
      </label>

      <button
        onClick={inStakeMode ? onStake : onWithdraw}
        disabled={inStakeMode ? isStakeDisabled || busy : isWithdrawDisabled || busy}
        className={`btn w-full ${inStakeMode ? "btn-b" : "btn-k"}`}
      >
        {busy ? "Processing…" : inStakeMode ? `Stake ${symbol}` : "Withdraw & claim rewards"}
      </button>

      {reason ? <p className="err !-mt-2 text-center !text-[var(--t2)]">{reason}</p> : null}

      <p className="note">
        Rewards are proportional to amount and time staked. Earlier stakers earn more within the same cycle.
      </p>
    </div>
  );
}
