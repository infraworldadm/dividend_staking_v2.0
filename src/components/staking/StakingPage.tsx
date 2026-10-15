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
import { Tour, type TourStep } from "@/components/staking/Tour";
import { Num } from "@/components/motion/Num";
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
  const [tourSignal, setTourSignal] = useState(0);

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
  const share =
    userInfo.weight === 0n
      ? "accruing"
      : sharePct < 0.01
        ? "<0.01%"
        : `${sharePct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

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

  const tourSteps: TourStep[] = [
    {
      title: "Welcome to the INFRA Dividend Pool",
      body: (
        <>
          <p>
            You stake <b>reAED</b> and earn a share of <b>real INFRA network fees</b>. There is no inflation, no new
            tokens, and <b>no fixed APR</b> — what you earn depends on how much the network makes and your weight in
            the pool.
          </p>
          <div className="tour-flow">
            <span>Stake<small>this month</small></span>
            <span>Earn<small>{nextCycle.label.split(" ")[0]} cycle</small></span>
            <span>Cycle closes<small>month end</small></span>
            <span>Claim<small>within 30 days</small></span>
          </div>
        </>
      ),
    },
    {
      target: '[data-tour="pool"]',
      title: "Where rewards come from",
      body: (
        <p>
          <b>Pool balance</b> is all reAED staked. The <b>reward vault</b> fills with network fees; that is the only
          source of rewards. Figures refresh every 10 seconds, live from the contract.
        </p>
      ),
    },
    {
      target: '[data-tour="stats"]',
      title: "Your numbers at a glance",
      body: (
        <p>
          Your <b>wallet balance</b>, the pool’s <b>total staked</b>, <b>your stake</b>, and when the <b>current
          monthly cycle ends</b>.
        </p>
      ),
    },
    {
      target: '[data-tour="guide"]',
      title: "This banner tells you what to do",
      body: (
        <p>
          Every time you come back, start here. It changes with your position: <b>stake for next month</b>, <b>you’re
          earning</b>, or <b>rewards ready — claim before the deadline</b>.
        </p>
      ),
    },
    {
      target: '[data-tour="panel"]',
      before: () => setTab("stake"),
      title: `Stake for ${nextCycle.label}`,
      body: (
        <>
          <p>
            Enter an amount, pick a <b>lock period</b> (30-day steps), accept the terms and confirm in your wallet.
          </p>
          <p>
            A stake made now <b>joins the next cycle</b> and starts earning on <b>{fmtDate(nextCycle.start)}</b>. One
            active stake per wallet.
          </p>
        </>
      ),
    },
    {
      title: "How your share is calculated",
      body: (
        <>
          <p>
            <b>Weight = amount × time staked.</b> Your share of a cycle is your weight divided by everyone’s weight.
            Stake more, or stay longer, and your share grows.
          </p>
          <div className="tour-eg">
            <div><span>Fees distributed in a cycle (example)</span><span>10,000 reAED</span></div>
            <div><span>Your weight ÷ total weight</span><span>5%</span></div>
            <div className="t"><span>Your reward</span><span>500 reAED</span></div>
          </div>
          <p className="text-[0.76rem]">Illustration only — actual rewards depend on real network fees.</p>
        </>
      ),
    },
    {
      target: '[data-tour="panel"]',
      before: () => setTab("earning"),
      title: "Earning now",
      body: (
        <p>
          Once staked, this tab shows your position in the <b>{curCycle.label}</b> cycle: amount, share of pool weight,
          lock countdown and total claimed. After the lock ends you can <b>unstake</b> your full principal here.
        </p>
      ),
    },
    {
      target: '[data-tour="panel"]',
      before: () => setTab("claim"),
      title: "Claim after the month closes",
      body: (
        <p>
          When a cycle ends, your rewards appear here. You have <b>30 days to claim</b> — after that they expire. The
          banner and a blue dot on this tab remind you.
        </p>
      ),
    },
    {
      target: '[data-tour="cycles"]',
      title: "Cycle calendar",
      body: (
        <p>
          <b>Previous</b> month: claim window. <b>Current</b> month: earning. <b>Next</b> month: open for new stakes.
          The history below lists every cycle with its claim deadline.
        </p>
      ),
    },
    {
      target: '[data-tour="where"]',
      title: "Next time you log in",
      body: (
        <p>
          Check the banner, or use these shortcuts: <b>Earning now</b> if you’ve staked, <b>Claim</b> after a cycle
          closes, <b>Stake</b> for the next month. You can replay this tour from <b>How it works</b> in the header.
        </p>
      ),
    },
  ];

  return (
    <>
      <Header onTour={() => setTourSignal((n) => n + 1)} />
      <Tour steps={tourSteps} openSignal={tourSignal} />
      <main className="wrap pb-12 pt-6 sm:pt-8">
        <section className="mb-3 grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div className="grid gap-3">
            <span className="pill justify-self-start" data-rv>
              <span className="pd">Live</span> Dividend pool on {appChain.name}
            </span>
            <h1 className="text-[clamp(1.8rem,3.6vw,2.6rem)]">
              <span className="hl-line"><span>Stake reAED.</span></span>
              <span className="hl-line text-[var(--blue)]"><span style={{ ["--d" as string]: "120ms" }}>Earn network revenue.</span></span>
            </h1>
            <p className="max-w-[480px] text-[0.92rem] text-[var(--t2)]" data-rv style={{ ["--d" as string]: "200ms" }}>
              No inflation. No emissions. Rewards are paid from real INFRA network fees, shared by weight across
              monthly cycles.
            </p>
            <button
              onClick={() => setTourSignal((n) => n + 1)}
              className="justify-self-start text-[0.85rem] font-medium text-[var(--blue)] hover:underline"
              data-rv
              style={{ ["--d" as string]: "280ms" }}
            >
              New here? Take the 1-minute tour →
            </button>
          </div>

          <div className="tile dark" data-tour="pool" data-rv style={{ ["--d" as string]: "150ms" }}>
            <div className="flex items-center justify-between">
              <span className="live">
                <i /> Pool balance
              </span>
              <span className="mono text-[0.7rem] text-white/40">Refreshes every 10s</span>
            </div>
            <div className="text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-none tracking-[-0.04em]">
              <Num value={formatToken(poolInfo.totalLocked, 2)} />
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

        <div data-tour="stats">
          <StatsCards cards={stats} />
        </div>

        <div className="mt-3" data-tour="guide" data-rv>
          <GuideBanner state={guide} symbol={symbol} go={goTab} />
        </div>

        <section ref={tabsRef} data-rv className="mt-3 grid scroll-mt-20 grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid content-start gap-3">
            <GuideTabs
              tab={activeTab}
              setTab={setTab}
              labels={{ earning: `Earning now · ${curCycle.label.split(" ")[0]}`, claim: "Claim", stake: `Stake for ${nextCycle.label.split(" ")[0]}` }}
              dots={{ claim: canClaim, earning: hasStake }}
            />

            <div className="tab-panel grid content-start gap-3" data-tour="panel" key={activeTab}>
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
          </div>

          <div className="grid content-start gap-3">
            <div className="tile" data-tour="where">
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
