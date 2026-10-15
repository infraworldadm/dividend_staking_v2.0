"use client";

import { cycleAt, cyclesAround, fmtDate, CLAIM_BUFFER_DAYS } from "@/lib/cycles";

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
};

const PERIOD_OPTIONS = [1, 2, 3, 6, 12];

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
}: StakePanelProps) {
  const { next } = cyclesAround(Math.floor(Date.now() / 1000));
  const [ny, nm] = next.key.split("-").map(Number);
  const last = cycleAt(ny, nm - 1 + periods - 1);
  const lockEnd = cycleAt(ny, nm - 1 + periods);
  const graceEnd = lockEnd.start + CLAIM_BUFFER_DAYS * 86400;

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
        <div className="chips">
          {PERIOD_OPTIONS.map((p) => (
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

      <label className="check">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        <span>
          I understand rewards depend on network fees (no fixed APR), and that rewards not claimed within{" "}
          {CLAIM_BUFFER_DAYS} days are forfeited.
        </span>
      </label>

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
