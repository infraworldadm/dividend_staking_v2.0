"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Header } from "@/components/staking/Header";
import { StatsCards, getDefaultIcons } from "@/components/staking/StatsCards";
import { StakePanel } from "@/components/staking/StakePanel";
import { RewardsPanel } from "@/components/staking/RewardsPanel";
import { HowItWorksCard } from "@/components/staking/HowItWorksCard";
import { CycleTimeline } from "@/components/staking/CycleTimeline";
import { cyclesAround, fmtDate } from "@/lib/cycles";
import { EmptyPanel, GuideBanner, GuideTabs, PositionPanel, type GuideState, type GuideTab } from "@/components/staking/StakeGuide";
import { SuccessOverlay, type SuccessKind, type SuccessState } from "@/components/staking/SuccessOverlay";
import { useDividendPoolReads } from "@/hooks/useDividendPoolReads";
import { useDividendPoolWrites } from "@/hooks/useDividendPoolWrites";
import { formatCountdown, formatToken } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";
import { appChain } from "@/lib/web3/chains";
import { dividendPoolAddress } from "@/lib/web3/contract";

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
  const [tab, setTabState] = useState<GuideTab>("stake");
  const tabTouched = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const { isConnected, address, poolInfo, userInfo, refetch } = useDividendPoolReads();
  const { data: wallet } = useBalance({ address });
  const { stake, claim, withdraw, txHash, hasActiveTx, isSigning, isConfirming, isConfirmed, errorMessage, reset } =
    useDividendPoolWrites();

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setResetTarget(cyclesAround(now).current.end);
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
      label: "Cycle ends in",
      value: formatCountdown(resetInSeconds),
      sub: "Monthly cycle · UTC",
      icon: icons.reset,
    },
  ];

  const nowSec = Math.floor(Date.now() / 1000);
  const { current: curCycle, previous: prevCycle, next: nextCycle } = cyclesAround(nowSec);
  const cycleProgress = Math.min(1, Math.max(0, (nowSec - curCycle.start) / (curCycle.end - curCycle.start)));
  const hasStake = userInfo.amount > 0n;
  const claimExpired = userInfo.rewardExpiryAt > 0n && rewardExpirySeconds === 0;
  const canClaim = userInfo.pendingClaimable > 0n && !claimExpired;
  const claimDeadline = fmtDate(userInfo.rewardExpiryAt > 0n ? Number(userInfo.rewardExpiryAt) : prevCycle.claimUntil);
  const sharePct =
    poolInfo.totalWeight > 0n ? Number((userInfo.weight * 1_000_000n) / poolInfo.totalWeight) / 10_000 : 0;
  const share = `${sharePct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

  const guide: GuideState = !isConnected
    ? { kind: "disconnected" }
    : canClaim
      ? {
          kind: "claim",
          amount: pendingRewards,
          deadline: claimDeadline,
          countdown: userInfo.rewardExpiryAt > 0n ? formatCountdown(rewardExpirySeconds) : formatCountdown(prevCycle.claimUntil - nowSec),
        }
      : hasStake
        ? { kind: "earning", amount: formatToken(userInfo.amount, 2), cycle: curCycle.label, share }
        : { kind: "idle", nextCycle: nextCycle.label, nextStart: fmtDate(nextCycle.start) };

  // Default tab follows the wallet's state until the user picks one.
  const autoTab: GuideTab = canClaim ? "claim" : hasStake ? "earning" : "stake";
  const activeTab = tabTouched.current ? tab : autoTab;
  const setTab = (t: GuideTab) => {
    tabTouched.current = true;
    setTabState(t);
    setMode(t === "earning" ? "withdraw" : "stake");
  };
  const goTab = (t: GuideTab) => {
    setTab(t);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const explorer = appChain.blockExplorers?.default.url.replace(/\/$/, "");
  const shortPool = `${dividendPoolAddress.slice(0, 6)}…${dividendPoolAddress.slice(-4)}`;

  const panelProps = (m: "stake" | "withdraw") => ({
    mode: m,
    setMode,
    amount,
    setAmount,
    periods,
    setPeriods,
    walletBalance,
    walletBalanceRaw,
    stakedAmount,
    weightMetricLabel: "Your share of pool weight",
    weightMetricValue: share,
    termsAccepted,
    setTermsAccepted,
    onStake: () => {
      pending.current = { kind: "stake" as const, amount: amount || "0" };
      stake(amount, periods);
    },
    onWithdraw: () => {
      pending.current = { kind: "withdraw" as const, amount: stakedAmount };
      withdraw();
    },
    isStakeDisabled: Boolean(stakeDisabledReason),
    stakeDisabledReason: stakeDisabledReason || contractError,
    isWithdrawDisabled: Boolean(withdrawDisabledReason),
    withdrawDisabledReason: withdrawDisabledReason || contractError,
    busy,
    symbol,
    lockMode: true,
  });

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
              monthly cycles.
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

        <div className="mt-3">
          <GuideBanner state={guide} symbol={symbol} go={goTab} />
        </div>

        <section ref={tabsRef} className="mt-3 grid scroll-mt-20 grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid content-start gap-3">
            <GuideTabs
              tab={activeTab}
              setTab={setTab}
              labels={{ earning: `Earning now · ${curCycle.label.split(" ")[0]}`, claim: "Claim", stake: `Stake for ${nextCycle.label.split(" ")[0]}` }}
              dots={{ claim: canClaim, earning: hasStake }}
            />

            {activeTab === "earning" ? (
              hasStake ? (
                <>
                  <PositionPanel
                    staked={formatToken(userInfo.amount, 2)}
                    symbol={symbol}
                    cycle={curCycle.label}
                    progress={cycleProgress}
                    share={share}
                    unlockIn={formatCountdown(unlockInSeconds)}
                    unlocked={unlockInSeconds === 0}
                    totalClaimed={formatToken(userInfo.totalClaimed, 2)}
                  />
                  <StakePanel {...panelProps("withdraw")} title="Unstake" />
                </>
              ) : (
                <EmptyPanel
                  label={`Earning now · ${curCycle.label}`}
                  title="You don’t have an active stake"
                  body={`Stake now to join the ${nextCycle.label} cycle. Earning starts ${fmtDate(nextCycle.start)}.`}
                  cta={`Stake for ${nextCycle.label}`}
                  onCta={() => setTab("stake")}
                />
              )
            ) : null}

            {activeTab === "claim" ? (
              <>
                <RewardsPanel
                  pendingRewards={pendingRewards}
                  symbol={symbol}
                  rewardExpiryIn={canClaim ? `${formatCountdown(rewardExpirySeconds || prevCycle.claimUntil - nowSec)} · by ${claimDeadline}` : "--"}
                  onClaim={() => {
                    pending.current = { kind: "claim", amount: pendingRewards };
                    claim();
                  }}
                  isClaimDisabled={Boolean(claimDisabledReason)}
                  claimDisabledReason={claimDisabledReason || contractError}
                  busy={busy}
                />
                <div className="tile !gap-2">
                  <span className="lbl"><i /> How claiming works</span>
                  <p className="text-[0.84rem] text-[var(--t2)]">
                    When a monthly cycle closes, your weight share of that month’s distribution becomes claimable.
                    You have 30 days to claim; after that, unclaimed rewards expire.
                  </p>
                  <div className="row"><span>Last closed cycle</span><span className="font-medium">{prevCycle.label}</span></div>
                  <div className="row"><span>Claim deadline</span><span className="font-medium">{claimDeadline}</span></div>
                  <div className="row"><span>Total claimed to date</span><span className="font-medium">{formatToken(userInfo.totalClaimed, 2)} {symbol}</span></div>
                </div>
              </>
            ) : null}

            {activeTab === "stake" ? (
              hasStake ? (
                <EmptyPanel
                  label={`Stake for ${nextCycle.label}`}
                  title="You already have an active stake"
                  body="The pool allows one active stake per wallet. Your stake keeps earning each cycle until you unstake after the lock ends."
                  cta="View my position"
                  onCta={() => setTab("earning")}
                />
              ) : (
                <StakePanel {...panelProps("stake")} title={`Stake for ${nextCycle.label} rewards`} />
              )
            ) : null}
          </div>

          <div className="grid content-start gap-3">
            <div className="tile">
              <span className="lbl"><i /> Where to go</span>
              <button className="row w-full text-left" onClick={() => goTab("earning")}>
                <span>Already staked?</span><span className="font-medium text-[var(--blue)]">Earning now →</span>
              </button>
              <div className="hr" />
              <button className="row w-full text-left" onClick={() => goTab("claim")}>
                <span>Cycle finished?</span><span className="font-medium text-[var(--blue)]">Claim rewards →</span>
              </button>
              <div className="hr" />
              <button className="row w-full text-left" onClick={() => goTab("stake")}>
                <span>New here?</span><span className="font-medium text-[var(--blue)]">Stake for {nextCycle.label} →</span>
              </button>
            </div>
            <HowItWorksCard />
          </div>
        </section>

        <CycleTimeline />

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
