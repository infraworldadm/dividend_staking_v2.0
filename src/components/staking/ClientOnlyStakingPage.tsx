"use client";

import dynamic from "next/dynamic";

const StakingPage = dynamic(
  () => import("@/components/staking/StakingPage").then((m) => m.StakingPage),
  { ssr: false },
);

export function ClientOnlyStakingPage() {
  return <StakingPage />;
}
