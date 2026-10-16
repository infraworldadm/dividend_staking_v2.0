"use client";

/**
 * @file Staking-window card (when stakes for next month close) and the 'why stake' advantages list.
 */
import { CalendarClock, Coins, Layers, LineChart, ShieldCheck, Unlock } from "lucide-react";
import { CLAIM_BUFFER_DAYS, cyclesAround, fmtDate, fmtEnd } from "@/lib/cycles";
import { formatCountdown } from "@/lib/format";

/**
 * Staking window for the NEXT month. The running month is closed to new stakes.
 * Shows the deadline, a 3-segment timeline (running · earning · claim), and live pool numbers.
 */
export function StakeWindow({
  now,
  joining,
  earningNow,
  poolNow,
  lastPool,
  symbol,
}: {
  now: number;
  joining: string;
  earningNow: string;
  poolNow: string;
  lastPool: string;
  symbol: string;
}) {
  const { current, next } = cyclesAround(now);
  const left = Math.max(0, next.start - now);
  const progress = Math.min(1, (now - current.start) / (current.end - current.start));
  const m = (c: { label: string }) => c.label.split(" ")[0];
  const claimEnd = next.claimUntil;

  return (
    <div className="tile sw !gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="lbl b">
          <i /> Staking window · {next.label}
        </span>
        <span className="st st-active">Open now</span>
      </div>

      <div className="grid gap-1">
        <div className="text-[0.82rem] text-[var(--t2)]">Window closes in</div>
        <div className="sw-count">{formatCountdown(left)}</div>
        <div className="mono text-[0.72rem] text-[var(--t3)]">{fmtEnd(next.start)} · 23:59 UTC — stakes after this join {m({ label: cyclesAround(next.start).next.label })}</div>
      </div>

      <div className="sw-line" aria-label="Cycle timeline">
        <div className="sws closed">
          <div className="bar"><b style={{ width: `${progress * 100}%` }} /></div>
          <span className="t">{m(current)} · running</span>
          <span className="d">Closed to new stakes</span>
        </div>
        <div className="sws earn">
          <div className="bar" />
          <span className="t">{m(next)} · you earn</span>
          <span className="d">{fmtDate(next.start)} → {fmtEnd(next.end)}</span>
        </div>
        <div className="sws claim">
          <div className="bar" />
          <span className="t">Claim · {CLAIM_BUFFER_DAYS} days</span>
          <span className="d">until {fmtDate(claimEnd)}</span>
        </div>
      </div>

      <div className="sw-stats">
        <div>
          <span>Joining {m(next)}</span>
          <b>{joining}</b>
          <small>{symbol} staked so far</small>
        </div>
        <div>
          <span>Earning in {m(current)}</span>
          <b>{earningNow}</b>
          <small>{symbol}</small>
        </div>
        <div>
          <span>{m(current)} reward pool</span>
          <b>{poolNow}</b>
          <small>{symbol} so far</small>
        </div>
        <div>
          <span>Last month’s pool</span>
          <b>{lastPool}</b>
          <small>{symbol} paid out</small>
        </div>
      </div>

      <p className="note">
        {m(current)} is already running, so new stakes can’t join it. Stake now to be in from day one of {next.label} and
        earn a full month’s share.
      </p>
    </div>
  );
}

const PERKS = [
  { icon: Coins, t: "Real yield", d: "Paid from INFRA network fees — no inflation, no new tokens." },
  { icon: CalendarClock, t: "Monthly payouts", d: "Each month’s fees are shared at month end; claim within 30 days." },
  { icon: Unlock, t: "Principal back", d: "Withdraw your full stake when the lock ends." },
  { icon: Layers, t: "Flexible lock", d: "Choose 1–12 months; you earn in every locked month." },
  { icon: LineChart, t: "Fair share", d: "Your reward = your stake ÷ total stake that month." },
  { icon: ShieldCheck, t: "On-chain & transparent", d: "Every month’s pool and payout is visible on INFRA Scan." },
];

export function WhyStake() {
  return (
    <div className="tile !gap-3" data-rv>
      <span className="lbl"><i /> Why stake in the pool</span>
      <ul className="perks">
        {PERKS.map(({ icon: Icon, t, d }) => (
          <li key={t}>
            <Icon aria-hidden />
            <span>
              <b>{t}</b>
              {d}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
