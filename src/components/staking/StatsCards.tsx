"use client";

import type { ReactNode } from "react";
import { Hourglass, Landmark, Scale, Wallet } from "lucide-react";
import { Num } from "@/components/motion/Num";

type StatCard = {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
};

export function StatsCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-rv-kids>
      {cards.map((card) => (
        <div key={card.label} className="tile lift !gap-3">
          <div className="flex items-center justify-between">
            <span className="lbl">{card.label}</span>
            <span className="text-[var(--blue)]">{card.icon}</span>
          </div>
          <div>
            <div className="text-[clamp(1.1rem,2vw,1.4rem)] font-semibold leading-none tracking-[-0.03em]">
              <Num value={card.value} />
            </div>
            <div className="mono mt-1 text-[0.72rem] text-[var(--t3)]">{card.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function getDefaultIcons() {
  return {
    pool: <Wallet className="h-4 w-4" />,
    total: <Landmark className="h-4 w-4" />,
    yours: <Scale className="h-4 w-4" />,
    reset: <Hourglass className="h-4 w-4" />,
  };
}
