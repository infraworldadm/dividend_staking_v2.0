"use client";

import { useEffect, useMemo, useState } from "react";
import { useBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Header } from "@/components/staking/Header";
import { StatsCards, getDefaultIcons } from "@/components/staking/StatsCards";
import { StakePanel } from "@/components/staking/StakePanel";
import { RewardsPanel } from "@/components/staking/RewardsPanel";
import { HowItWorksCard } from "@/components/staking/HowItWorksCard";
import { useDividendPoolReads } from "@/hooks/useDividendPoolReads";
import { useDividendPoolWrites } from "@/hooks/useDividendPoolWrites";
import { formatCountdown, formatToken } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";

function getThirtyDayCycleLeftSeconds(now: number) {
  const cycle = 30 * 24 * 60 * 60;
  const elapsed = now % cycle;
  return cycle - elapsed;
}

function mapError(msg: string | null) {
  if (!msg) return null;
  if (msg.includes("Already staked")) return "You already have an active stake.";
  if (msg.includes("Lock not expired")) return "Your lock period has not ended yet.";
  if (msg.includes("Reward expired")) return "Claim window ended for current rewards.";
  if (msg.includes("No rewards")) return "No claimable rewards.";
  if (msg.includes("No stake found")) return "No active stake found.";
  return msg;
}

export function StakingPage() {
  const icons = getDefaultIcons();
  const [mode, setMode] = useState<"stake" | "withdraw">("stake");
  const [amount, setAmount] = useState("0.00");
  const [periods, setPeriods] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resetTarget, setResetTarget] = useState(0);

  const { isConnected, address, poolInfo, userInfo, refetch } = useDividendPoolReads();
  const { data: wallet } = useBalance({ address });
  const { stake, claim, withdraw, hasActiveTx, isSigning, isConfirming, isConfirmed, errorMessage, reset } =
    useDividendPoolWrites();

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setResetTarget(now + getThirtyDayCycleLeftSeconds(now));
  }, []);

  const resetInSeconds = useCountdown(resetTarget);
  const unlockInSeconds = useCountdown(Number(userInfo.endDate));
  const rewardExpirySeconds = useCountdown(Number(userInfo.rewardExpiryAt));

  useEffect(() => {
    if (isConfirmed) {
      refetch();
      reset();
    }
  }, [isConfirmed, refetch, reset]);

  const symbol = "ReAED";

  const walletBalance = useMemo(() => {
    const value = wallet?.value;
    return value ? formatToken(value, 4) : "0.0000";
  }, [wallet?.value]);
  const walletBalanceRaw = useMemo(() => {
    return wallet?.value ? formatEther(wallet.value) : "0";
  }, [wallet?.value]);

  const stakedAmount = formatToken(userInfo.amount, 4);
  const pendingRewards = formatToken(userInfo.pendingClaimable, 2);
  const contractError = mapError(errorMessage);

  const stakeDisabledReason = useMemo(() => {
    if (!isConnected) return "Connect wallet to stake.";
    if (!termsAccepted) return "Accept terms before staking.";
    if (userInfo.amount > 0n) return "You already have an active stake.";

    try {
      const parsed = parseEther(amount || "0");
      if (parsed <= 0n) return "Enter a valid amount.";
      if (wallet?.value && parsed > wallet.value) return "Insufficient wallet balance.";
    } catch {
      return "Enter a valid amount.";
    }

    return null;
  }, [amount, isConnected, termsAccepted, userInfo.amount, wallet?.value]);

  const withdrawDisabledReason = useMemo(() => {
    if (!isConnected) return "Connect wallet to withdraw.";
    if (!termsAccepted) return "Accept terms before withdrawing.";
    if (userInfo.amount === 0n) return "No active stake found.";
    if (unlockInSeconds > 0) return `Unlocks in ${formatCountdown(unlockInSeconds)}.`;
    if (userInfo.pendingClaimable > 0n && userInfo.rewardExpiryAt > 0n && rewardExpirySeconds === 0)
      return "Claim window ended for current rewards.";
    return null;
  }, [
    isConnected,
    termsAccepted,
    userInfo.amount,
    unlockInSeconds,
    userInfo.pendingClaimable,
    userInfo.rewardExpiryAt,
    rewardExpirySeconds,
  ]);

  const claimDisabledReason = useMemo(() => {
    if (!isConnected) return "Connect wallet to claim.";
    if (userInfo.pendingClaimable === 0n) return "No claimable rewards.";
    if (userInfo.rewardExpiryAt > 0n && rewardExpirySeconds === 0) return "Claim window ended for current rewards.";
    return null;
  }, [isConnected, rewardExpirySeconds, userInfo.pendingClaimable, userInfo.rewardExpiryAt]);

  const busy = isSigning || (hasActiveTx && isConfirming);

  const stats = [
    {
      label: "Pool Balance",
      value: formatToken(poolInfo.totalLocked, 2),
      sub: symbol,
      icon: icons.pool,
      isPrimary: true,
    },
    {
      label: "Total Stakes",
      value: formatToken(poolInfo.totalStaked, 2),
      sub: symbol,
      icon: icons.total,
    },
    {
      label: "Your Stakes",
      value: formatToken(userInfo.amount, 2),
      sub: symbol,
      icon: icons.yours,
    },
    {
      label: "Reset In",
      value: formatCountdown(resetInSeconds),
      sub: symbol,
      icon: icons.reset,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Header />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-borderSoft bg-white px-2 py-1 text-xs text-textMuted">
            <span className="text-brand">•</span> Dividend staking pool
          </div>
          <h1 className="text-[48px] font-extrabold leading-tight">INFRA Staking</h1>
          <p className="mt-1 text-textMuted">No inflation. No emissions. Pure network revenue.</p>
        </div>

        <div className="h-[102px] w-full max-w-[520px] rounded-xl2 border border-borderSoft bg-[radial-gradient(circle_at_20%_20%,#1b62d9,#1d1d1f)] p-4 text-white shadow-card">
          <div className="text-xs uppercase text-blue-100">REID</div>
          <div className="mt-1 text-2xl font-bold">One Identity For Everything.</div>
          <div className="mt-1 text-xs text-blue-100">A single, simple ID to access apps, money, and connections.</div>
        </div>
      </div>

      <StatsCards cards={stats} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <StakePanel
          mode={mode}
          setMode={setMode}
          amount={amount}
          setAmount={setAmount}
          periods={periods}
          setPeriods={setPeriods}
          walletBalance={walletBalance}
          walletBalanceRaw={walletBalanceRaw}
          stakedAmount={stakedAmount}
          weightMetricLabel={mode === "stake" ? "Weight Accumulated" : "Weight Lost"}
          weightMetricValue={mode === "stake" ? "0.00%" : "0.00%"}
          termsAccepted={termsAccepted}
          setTermsAccepted={setTermsAccepted}
          onStake={() => stake(amount, periods)}
          onWithdraw={withdraw}
          isStakeDisabled={Boolean(stakeDisabledReason)}
          stakeDisabledReason={stakeDisabledReason || contractError}
          isWithdrawDisabled={Boolean(withdrawDisabledReason)}
          withdrawDisabledReason={withdrawDisabledReason || contractError}
          busy={busy}
          symbol={symbol}
        />

        <div className="space-y-4">
          <RewardsPanel
            pendingRewards={pendingRewards}
            symbol={symbol}
            rewardExpiryIn={
              userInfo.pendingClaimable > 0n && userInfo.rewardExpiryAt > 0n
                ? formatCountdown(rewardExpirySeconds)
                : "--"
            }
            onClaim={claim}
            isClaimDisabled={Boolean(claimDisabledReason)}
            claimDisabledReason={claimDisabledReason || contractError}
            busy={busy}
          />
          <div className="rounded-xl2 border border-borderSoft bg-cardBg p-4 text-sm text-slate-600 shadow-card">
            <p>
              <strong>Unlock in:</strong> {userInfo.amount > 0n ? formatCountdown(unlockInSeconds) : "--"}
            </p>
            <p className="mt-2">
              <strong>Reward expires in:</strong>{" "}
              {userInfo.pendingClaimable > 0n && userInfo.rewardExpiryAt > 0n
                ? formatCountdown(rewardExpirySeconds)
                : "--"}
            </p>
          </div>
          <HowItWorksCard />
        </div>
      </div>
    </main>
  );
}
