"use client";

/**
 * @file Connected wallet's on-chain activity (stakes, claims, withdrawals) read from contract events.
 */
import { fmtDate } from "@/lib/cycles";
import { formatToken } from "@/lib/format";
import type { ActivityItem } from "@/hooks/useActivity";

const LABEL: Record<ActivityItem["kind"], { t: string; sign: string; cls: string }> = {
  stake: { t: "Staked", sign: "−", cls: "" },
  claim: { t: "Rewards claimed", sign: "+", cls: "text-[var(--blue)]" },
  withdraw: { t: "Principal withdrawn", sign: "+", cls: "" },
  forfeit: { t: "Rewards forfeited", sign: "", cls: "text-[#b45309]" },
};

/** The wallet's on-chain history (stakes, claims, withdrawals, forfeits). */
export function ActivityList({
  items,
  loading,
  symbol,
  explorer,
}: {
  items: ActivityItem[];
  loading: boolean;
  symbol: string;
  explorer?: string;
}) {
  return (
    <div className="tile !gap-2" data-rv>
      <div className="flex items-center justify-between">
        <span className="lbl"><i /> Your activity</span>
        {loading ? <span className="mono text-[0.7rem] text-[var(--t3)]">Loading…</span> : null}
      </div>
      {items.length === 0 && !loading ? (
        <p className="text-[0.84rem] text-[var(--t2)]">No activity yet. Your stakes, claims and withdrawals will appear here.</p>
      ) : (
        <ul className="act">
          {items.map((x, i) => {
            const l = LABEL[x.kind];
            return (
              <li key={`${x.hash}-${x.kind}-${i}`}>
                <span className="t">
                  {l.t}
                  {x.kind === "stake" && x.extra ? <small> · {String(x.extra)} mo lock</small> : null}
                </span>
                <span className={`a mono ${l.cls}`}>
                  {l.sign}
                  {formatToken(x.amount, 2)} {symbol}
                </span>
                <span className="d mono">
                  {x.time ? fmtDate(x.time) : ""}
                  {explorer ? (
                    <a href={`${explorer}/tx/${x.hash}`} target="_blank" rel="noreferrer">↗</a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
