"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Header } from "@/components/staking/Header";
import { StatsCards, getDefaultIcons } from "@/components/staking/StatsCards";
import { StakePanel } from "@/components/staking/StakePanel";
import { RewardsPanel } from "@/components/staking/RewardsPanel";
import { HowItWorksCard } from "@/components/staking/HowItWorksCard";
import { SuccessOverlay, type SuccessKind, type SuccessState } from "@/components/staking/SuccessOverlay";
import { useDividendPoolReads } from "@/hooks/useDividendPoolReads";
import { useDividendPoolWrites } from "@/hooks/useDividendPoolWrites";
import { formatCountdown, formatToken } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";
import { appChain } from "@/lib/web3/chains";
import { dividendPoolAddress } from "@/lib/web3/contract";

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
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const pending = useRef<{ kind: SuccessKind; amount: string } | null>(null);
  const closeSuccess = useCallback(() => setSuccess(null), []);

  const { isConnected, address, poolInfo, userInfo, refetch } = useDividendPoolReads();
  const { data: wallet } = useBalance({ address });
  const { stake, claim, withdraw, txHash, hasActiveTx, isSigning, isConfirming, isConfirmed, errorMessage, reset } =
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
      if (pending.current) {
        setSuccess({ ...pending.current, symbol: "ReAED", hash: txHash });
        pending.current = null;
      }
      refetch();
      reset();
    }
  }, [isConfirmed, refetch, reset, txHash]);

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
      label: "Wallet balance",
      value: formatToken(wallet?.value ?? 0n, 2),
      sub: symbol,
      icon: icons.pool,
    },
    {
      label: "Total staked",
      value: formatToken(poolInfo.totalStaked, 2),
      sub: symbol,
      icon: icons.total,
    },
    {
      label: "Your stake",
      value: formatToken(userInfo.amount, 2),
      sub: symbol,
      icon: icons.yours,
    },
    {
      label: "Cycle resets in",
      value: formatCountdown(resetInSeconds),
      sub: "30-day cycle",
      icon: icons.reset,
    },
  ];

  const explorer = appChain.blockExplorers?.default.url.replace(/\/$/, "");
  const shortPool = `${dividendPoolAddress.slice(0, 6)}…${dividendPoolAddress.slice(-4)}`;

  return (
    <>
      <Header />
      <main className="wrap pb-12 pt-6 sm:pt-8">
        <section className="mb-3 grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div className="grid gap-3">
            <span className="pill justify-self-start">
              <span className="pd">Live</span> Dividend pool on {appChain.name}
            </span>
            <h1 className="text-[clamp(1.8rem,3.6vw,2.6rem)]">
              Stake reAED.
              <span className="block text-[var(--blue)]">Earn network revenue.</span>
            </h1>
            <p className="max-w-[480px] text-[0.92rem] text-[var(--t2)]">
              No inflation. No emissions. Rewards are paid from real INFRA network fees, shared by weight across
              30-day cycles.
            </p>
          </div>

          <div className="tile dark">
            <div className="flex items-center justify-between">
              <span className="live">
                <i /> Pool balance
              </span>
              <span className="mono text-[0.7rem] text-white/40">Refreshes every 10s</span>
            </div>
            <div className="text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-none tracking-[-0.04em]">
              {formatToken(poolInfo.totalLocked, 2)}
              <span className="mono ml-2 text-[0.9rem] font-normal tracking-normal text-white/50">{symbol}</span>
            </div>
            <div className="hr" />
            <div className="row">
              <span className="!text-white/60">Reward vault</span>
              <span className="mono text-[0.85rem]">
                {formatToken(poolInfo.rewardVaultBalance, 2)} {symbol}
              </span>
            </div>
          </div>
        </section>

        <StatsCards cards={stats} />

        <section className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
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
            weightMetricLabel={mode === "stake" ? "Weight accumulated" : "Weight lost"}
            weightMetricValue={mode === "stake" ? "0.00%" : "0.00%"}
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
            onStake={() => {
              pending.current = { kind: "stake", amount: amount || "0" };
              stake(amount, periods);
            }}
            onWithdraw={() => {
              pending.current = { kind: "withdraw", amount: stakedAmount };
              withdraw();
            }}
            isStakeDisabled={Boolean(stakeDisabledReason)}
            stakeDisabledReason={stakeDisabledReason || contractError}
            isWithdrawDisabled={Boolean(withdrawDisabledReason)}
            withdrawDisabledReason={withdrawDisabledReason || contractError}
            busy={busy}
            symbol={symbol}
          />

          <div className="grid content-start gap-3">
            <RewardsPanel
              pendingRewards={pendingRewards}
              symbol={symbol}
              rewardExpiryIn={
                userInfo.pendingClaimable > 0n && userInfo.rewardExpiryAt > 0n
                  ? formatCountdown(rewardExpirySeconds)
                  : "--"
              }
              onClaim={() => {
                pending.current = { kind: "claim", amount: pendingRewards };
                claim();
              }}
              isClaimDisabled={Boolean(claimDisabledReason)}
              claimDisabledReason={claimDisabledReason || contractError}
              busy={busy}
            />

            <div className="tile">
              <span className="lbl">
                <i /> Your position
              </span>
              <div className="row">
                <span>Unlocks in</span>
                <span className="mono text-[0.85rem]">
                  {userInfo.amount > 0n ? formatCountdown(unlockInSeconds) : "--"}
                </span>
              </div>
              <div className="hr" />
              <div className="row">
                <span>Total claimed</span>
                <span className="mono text-[0.85rem]">
                  {formatToken(userInfo.totalClaimed, 2)} {symbol}
                </span>
              </div>
            </div>

            <HowItWorksCard />
          </div>
        </section>

        <SuccessOverlay state={success} explorer={explorer} onClose={closeSuccess} />

        {txHash && explorer ? (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--black)] px-5 py-3 text-[0.85rem] text-white shadow-lg"
          >
            {isConfirming ? "Confirming transaction…" : "Transaction sent"} · <span className="text-[var(--blue-l)]">View on explorer</span>
          </a>
        ) : null}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6 text-[0.8rem] text-[var(--t3)]">
          <span>© {new Date().getFullYear()} INFRA · Dividend Pool</span>
          {explorer ? (
            <a
              href={`${explorer}/address/${dividendPoolAddress}`}
              target="_blank"
              rel="noreferrer"
              className="mono transition-colors hover:text-[var(--blue)]"
            >
              Contract {shortPool} ↗
            </a>
          ) : null}
        </footer>
      </main>
    </>
  );
}
