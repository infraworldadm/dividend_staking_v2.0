"use client";

import { useEffect, useState } from "react";
import { CLAIM_BUFFER_DAYS, cycleHistory, cyclesAround, fmtDate, fmtEnd, statusOf, type CycleStatus } from "@/lib/cycles";
import { formatCountdown } from "@/lib/format";

const STATUS: Record<CycleStatus, { text: string; cls: string }> = {
  upcoming: { text: "Next", cls: "st-next" },
  active: { text: "Earning", cls: "st-active" },
  claimable: { text: "Claim open", cls: "st-claim" },
  expired: { text: "Closed", cls: "st-closed" },
};

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = () => setNow(Math.floor(Date.now() / 1000));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Monthly cycle overview: previous claim window, current earning month, next cycle, and history. */
export function CycleTimeline() {
  const now = useNow();
  if (!now) return null;
  const { previous, current, next } = cyclesAround(now);
  const progress = Math.min(1, (now - current.start) / (current.end - current.start));
  const history = cycleHistory(now);

  return (
    <section className="mt-3 grid gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="tile">
          <div className="flex items-center justify-between">
            <span className="lbl">Previous · {previous.label}</span>
            <span className={`st ${STATUS[statusOf(previous, now)].cls}`}>{STATUS[statusOf(previous, now)].text}</span>
          </div>
          <div className="text-[1.15rem] font-semibold tracking-[-0.02em]">
            {statusOf(previous, now) === "claimable" ? `Claim closes in ${formatCountdown(previous.claimUntil - now)}` : "Claim window expired"}
          </div>
          <p className="text-[0.8rem] text-[var(--t2)]">
            Closed {fmtEnd(previous.end)}. Claim by <b className="font-medium text-[var(--t1)]">{fmtDate(previous.claimUntil)}</b>.
          </p>
        </div>

        <div className="tile dark">
          <div className="flex items-center justify-between">
            <span className="live">
              <i /> Current · {current.label}
            </span>
            <span className="mono text-[0.7rem] text-white/50">{Math.floor(progress * 100)}%</span>
          </div>
          <div className="text-[1.15rem] font-semibold tracking-[-0.02em]">Ends in {formatCountdown(current.end - now)}</div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-[0.8rem]">
            {fmtDate(current.start)} → {fmtEnd(current.end)} · claimable until {fmtDate(current.claimUntil)}
          </p>
        </div>

        <div className="tile">
          <div className="flex items-center justify-between">
            <span className="lbl b">
              <i /> Next · {next.label}
            </span>
            <span className="st st-next">Open for stakes</span>
          </div>
          <div className="text-[1.15rem] font-semibold tracking-[-0.02em]">Starts in {formatCountdown(next.start - now)}</div>
          <p className="text-[0.8rem] text-[var(--t2)]">
            Stakes made now earn from <b className="font-medium text-[var(--t1)]">{fmtDate(next.start)}</b> to {fmtEnd(next.end)}.
          </p>
        </div>
      </div>

      <div className="tile !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] pt-4">
          <span className="lbl">
            <i /> Cycle history
          </span>
          <span className="mono text-[0.7rem] text-[var(--t3)]">
            Monthly cycles · {CLAIM_BUFFER_DAYS}-day claim window · UTC
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="cyc">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Claim until</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => {
                const s = statusOf(c, now);
                return (
                  <tr key={c.key} className={s === "active" ? "on" : undefined}>
                    <td className="font-medium">{c.label}</td>
                    <td>{fmtDate(c.start)}</td>
                    <td>{fmtEnd(c.end)}</td>
                    <td>{fmtDate(c.claimUntil)}</td>
                    <td>
                      <span className={`st ${STATUS[s].cls}`}>{STATUS[s].text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
