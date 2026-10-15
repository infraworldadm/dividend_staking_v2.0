"use client";

import type { ReactNode } from "react";
import { Hourglass, Landmark, Scale, Wallet } from "lucide-react";

type StatCard = {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
};

export function StatsCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="tile !gap-5">
          <div className="flex items-center justify-between">
            <span className="lbl">{card.label}</span>
            <span className="text-[var(--blue)]">{card.icon}</span>
          </div>
          <div>
            <div className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-none tracking-[-0.03em]">
              {card.value}
            </div>
            <div className="mono mt-2 text-[0.72rem] text-[var(--t3)]">{card.sub}</div>
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
