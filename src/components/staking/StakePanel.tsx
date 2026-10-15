"use client";

import { parseEther } from "viem";
import { cycleAt, cyclesAround, fmtDate, CLAIM_BUFFER_DAYS } from "@/lib/cycles";
import { formatToken } from "@/lib/format";

type StakePanelProps = {
  amount: string;
  setAmount: (value: string) => void;
  periods: number;
  setPeriods: (value: number) => void;
  walletBalance: string;
  walletBalanceRaw: string;
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  onStake: () => void;
  disabledReason: string | null;
  busy: boolean;
  symbol: string;
  /** principal already joining next month */
  nextJoinTotal: bigint;
  /** reference reward pool used for the illustration (this month so far) */
  refPool: bigint;
  refLabel: string;
  /** lock options from the contract */
  periodOptions: number[];
};


/** Stake form: amount, lock months, and exactly which months the stake will earn in. */
export function StakePanel({
  amount,
  setAmount,
  periods,
  setPeriods,
  walletBalance,
  walletBalanceRaw,
  termsAccepted,
  setTermsAccepted,
  onStake,
  disabledReason,
  busy,
  symbol,
  nextJoinTotal,
  refPool,
  refLabel,
  periodOptions,
}: StakePanelProps) {
  let amt = 0n;
  try {
    amt = parseEther(amount || "0");
  } catch {
    amt = 0n;
  }
  const pool = nextJoinTotal + amt;
  const sharePct = pool > 0n && amt > 0n ? Number((amt * 1_000_000n) / pool) / 10_000 : 0;
  const est = pool > 0n ? (refPool * amt) / pool : 0n;
  const { next } = cyclesAround(Math.floor(Date.now() / 1000));
  const [ny, nm] = next.key.split("-").map(Number);
  const last = cycleAt(ny, nm - 1 + periods - 1);
  const lockEnd = cycleAt(ny, nm - 1 + periods);
  const graceEnd = lockEnd.start + CLAIM_BUFFER_DAYS * 86400;
  const secondsLeft = next.start - Math.floor(Date.now() / 1000);
  const after = cycleAt(ny, nm); // the month after next

  return (
    <div className="tile !gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="lbl b">
          <i /> Stake for {next.label} rewards
        </span>
        <span className="mono text-[0.72rem] text-[var(--t3)]">
          Wallet · {walletBalance} {symbol}
        </span>
      </div>

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
          <span className="mono text-[0.75rem] text-[var(--t3)]">earns in each locked month</span>
        </div>
        <div className="chips" style={{ ["--n" as string]: periodOptions.length }}>
          {periodOptions.map((p) => (
            <button key={p} aria-pressed={periods === p} onClick={() => setPeriods(p)}>
              {p} mo
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5 rounded-xl bg-[var(--field)] px-3.5 py-3">
        <div className="row">
          <span>Earns in</span>
          <span className="font-medium">{periods === 1 ? next.label : `${next.label} → ${last.label}`}</span>
        </div>
        <div className="row">
          <span>Lock ends, earning stops</span>
          <span className="font-medium">{fmtDate(lockEnd.start)}</span>
        </div>
        <div className="row">
          <span>Withdraw with rewards by</span>
          <span className="font-medium">{fmtDate(graceEnd)}</span>
        </div>
      </div>

      <div className="proj">
        <div className="row">
          <span>Your share of {next.label.split(" ")[0]} (so far)</span>
          <span className="big">{amt > 0n ? `${sharePct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : "—"}</span>
        </div>
        <div className="row">
          <span>If the pool matches {refLabel} ({formatToken(refPool, 2)})</span>
          <span className="font-medium">≈ {formatToken(est, 2)} {symbol} / month</span>
        </div>
        <div className="row">
          <span>Already joining {next.label.split(" ")[0]}</span>
          <span className="mono text-[0.8rem]">{formatToken(nextJoinTotal, 2)} {symbol}</span>
        </div>
        <p className="!text-[0.72rem] !text-white/50">
          Illustration only — your share changes as others join, and the pool depends on real network fees. No APR.
        </p>
      </div>

      <label className="check">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        <span>
          I understand rewards depend on network fees (no fixed APR), and that rewards not claimed within{" "}
          {CLAIM_BUFFER_DAYS} days are forfeited.
        </span>
      </label>

      {secondsLeft < 3600 ? (
        <p className="note !bg-[#fff4e5] !text-[#b45309]">
          Less than an hour left in this window. If your transaction confirms after 00:00 UTC it will join{" "}
          {after.label} instead of {next.label}.
        </p>
      ) : null}

      <button onClick={onStake} disabled={Boolean(disabledReason) || busy} className="btn btn-b w-full">
        {busy ? "Processing…" : `Stake ${symbol}`}
      </button>

      {disabledReason ? <p className="err !-mt-2 text-center !text-[var(--t2)]">{disabledReason}</p> : null}

      <p className="note">
        Your share each month = your stake ÷ everyone’s stake that month, applied to what the dividend pool sends at month
        end.
      </p>
    </div>
  );
}
