"use client";

import type { ReactNode } from "react";
import { Hourglass, Landmark, Scale, Wallet } from "lucide-react";

type StatCard = {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  isPrimary?: boolean;
};

export function StatsCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl2 border p-4 shadow-card ${
            card.isPrimary ? "border-blue-200 bg-[#f8fbff]" : "border-borderSoft bg-cardBg"
          }`}
        >
          <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-brand">
            {card.icon}
            <span>{card.label}</span>
          </div>
          <div className="text-[30px] font-bold leading-none text-slate-900">{card.value}</div>
          <div className="mt-2 text-xs text-textMuted">{card.sub}</div>
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
