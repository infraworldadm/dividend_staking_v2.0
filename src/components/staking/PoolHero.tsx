"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Num } from "@/components/motion/Num";
import { formatToken } from "@/lib/format";

/**
 * The headline number: live dividend-pool balance for this month, big and animated.
 * Glowing rotating border, live pulse, and a "+X" flash whenever new fees arrive.
 */
export function PoolHero({
  amount,
  dividend,
  month,
  nextMonth,
  payDate,
  symbol,
  onStake,
}: {
  amount: bigint;
  dividend: bigint;
  month: string;
  nextMonth: string;
  payDate: string;
  symbol: string;
  onStake: () => void;
}) {
  const prev = useRef<bigint | null>(null);
  const [delta, setDelta] = useState<bigint>(0n);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (prev.current !== null && prev.current > 0n && amount > prev.current) {
      setDelta(amount - prev.current);
      setFlashKey((k) => k + 1);
    }
    prev.current = amount;
  }, [amount]);

  return (
    <div className="poolhero" data-tour="pool" data-rv style={{ ["--d" as string]: "150ms" }}>
      <div className="ph-in">
        <div className="flex items-center justify-between gap-2">
          <span className="live">
            <i /> Dividend pool · {month.split(" ")[0]}
          </span>
          <span className="mono text-[0.68rem] text-white/45">LIVE</span>
        </div>

        <div className="ph-amt">
          <Num value={formatToken(amount, 2)} duration={1400} />
          <span className="ph-sym">{symbol}</span>
          {flashKey > 0 ? (
            <span key={flashKey} className="ph-delta">
              +{formatToken(delta, 2)}
            </span>
          ) : null}
        </div>
        <p className="ph-sub">
          Network fees collected so far in {month.split(" ")[0]}, shared among its stakers by weight. Stake now to join{" "}
          <b>{nextMonth.split(" ")[0]}’s pool</b>.
        </p>

        <div className="ph-bar"><i /></div>

        <div className="grid grid-cols-2 gap-2 text-[0.78rem]">
          <div className="ph-mini">
            <span>Pays out</span>
            <b>{payDate}</b>
          </div>
          <div className="ph-mini">
            <span>In the dividend pool now</span>
            <b className="mono">{formatToken(dividend, 2)}</b>
          </div>
        </div>

        <button className="ph-cta" onClick={onStake}>
          Stake now to share {nextMonth.split(" ")[0]}’s pool <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
