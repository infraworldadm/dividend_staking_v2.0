"use client";

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
    <div className="rounded-xl2 border border-blue-400 bg-gradient-to-br from-[#0d5be9] to-[#0a3f9a] p-5 text-white shadow-card">
      <p className="text-xs tracking-wide text-blue-100">PENDING REWARDS</p>
      <div className="mt-3 text-5xl font-bold leading-none">{pendingRewards}</div>
      <div className="mt-2 text-sm text-blue-100">{symbol}</div>
      <div className="mt-2 text-xs text-blue-200">Reward expires in: {rewardExpiryIn}</div>
      <button
        className="mt-5 w-full rounded-lg bg-white py-3 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onClaim}
        disabled={isClaimDisabled || busy}
        title={claimDisabledReason || ""}
      >
        {busy ? "Processing..." : "Claim Rewards"}
      </button>
      {claimDisabledReason ? <p className="mt-2 text-xs text-blue-200">{claimDisabledReason}</p> : null}
    </div>
  );
}
