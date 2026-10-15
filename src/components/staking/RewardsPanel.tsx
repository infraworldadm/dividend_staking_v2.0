"use client";

import { ArrowRight } from "lucide-react";

type RewardsPanelProps = {
  pendingRewards: string;
  symbol: string;
  rewardExpiryIn: string;
  onClaim: () => void;
  isClaimDisabled: boolean;
  claimDisabledReason: string | null;
  busy: boolean;
};

export function RewardsPanel({
  pendingRewards,
  symbol,
  rewardExpiryIn,
  onClaim,
  isClaimDisabled,
  claimDisabledReason,
  busy,
}: RewardsPanelProps) {
  return (
    <div className="tile blue">
      <span className="lbl">
        <i /> Pending rewards
      </span>
      <div>
        <div className="text-[clamp(1.8rem,3.4vw,2.3rem)] font-semibold leading-none tracking-[-0.04em]">
          {pendingRewards}
        </div>
        <div className="mono mt-1 text-[0.75rem] text-white/70">{symbol}</div>
      </div>
      <div className="hr" />
      <div className="row">
        <span className="!text-white/70">Claim window closes in</span>
        <span className="mono text-[0.85rem]">{rewardExpiryIn}</span>
      </div>
      <button className="btn btn-w w-full" onClick={onClaim} disabled={isClaimDisabled || busy}>
        {busy ? "Processing…" : "Claim rewards"} {!busy ? <ArrowRight /> : null}
      </button>
      {claimDisabledReason ? <p className="!text-[0.8rem] !text-white/70">{claimDisabledReason}</p> : null}
    </div>
  );
}
