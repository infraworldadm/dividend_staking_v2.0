"use client";

/**
 * @file Main staking page: composes hero, stats, guide banner, tabs (My stakes / Claim / Stake), cycles, activity and the guided tour. Owns UI state derived from useStakingPool.
 */
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
import { PoolHero } from "@/components/staking/PoolHero";
import { StakeWindow, WhyStake } from "@/components/staking/StakeWindow";
import { ActivityList } from "@/components/staking/ActivityList";
import { useActivity } from "@/hooks/useActivity";
import { CLAIM_BUFFER_DAYS, cycleOfEpoch, cyclesAround, fmtDate } from "@/lib/cycles";
import {
  EmptyPanel,
  GuideBanner,
  GuideTabs,
  PositionsPanel,
  type GuideState,
  type GuideTab,
  type PositionStatus,
  type PositionView,
} from "@/components/staking/StakeGuide";
import { SuccessOverlay, type SuccessKind, type SuccessState } from "@/components/staking/SuccessOverlay";
import { useStakingPool, useStakingWrites } from "@/hooks/useStakingPool";
import { formatCountdown, formatToken } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";
import { appChain } from "@/lib/web3/chains";
import { stakingPoolAddress } from "@/lib/web3/contract";

const SYMBOL = "ReAED";

/** Contract revert reasons → plain language. */
function mapError(msg: string | null) {
  if (!msg) return null;
  if (msg.includes("Too many positions")) return "You have the maximum of 20 open positions.";
  if (msg.includes("Lock not expired")) return "Your lock period has not ended yet.";
  if (msg.includes("No rewards")) return "No claimable rewards.";
  if (msg.includes("No stake found")) return "No stake found.";
  if (msg.includes("Bad periods")) return "Choose a lock between 1 and 12 months.";
  if (msg.includes("User rejected") || msg.includes("denied")) return "Transaction cancelled in wallet.";
  return msg;
}

const pct = (num: bigint, den: bigint) => {
  if (den === 0n || num === 0n) return "0%";
  const v = Number((num * 1_000_000n) / den) / 10_000;
  return v < 0.01 ? "<0.01%" : `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
};

export function StakingPage() {
  const icons = getDefaultIcons();
  const [amount, setAmount] = useState("0.00");
  const [periods, setPeriods] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cycleEndTarget, setCycleEndTarget] = useState(0);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const pending = useRef<{ kind: SuccessKind; amount: string } | null>(null);
  const closeSuccess = useCallback(() => setSuccess(null), []);
  // null = follow the wallet's state; set once the user picks a tab
  const [tab, setTabState] = useState<GuideTab | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tourSignal, setTourSignal] = useState(0);

  const s = useStakingPool();
  const { data: wallet } = useBalance({ address: s.address });
  const w = useStakingWrites();
  const [activityKey, setActivityKey] = useState(0);
  const activity = useActivity(s.address, activityKey);

  useEffect(() => {
    setCycleEndTarget(cyclesAround(Math.floor(Date.now() / 1000)).current.end);
  }, []);

  const cycleEndsIn = useCountdown(cycleEndTarget);
  const claimEndsIn = useCountdown(Number(s.pendingDeadline));

  // After a confirmed tx: success animation + refresh
  useEffect(() => {
    if (w.isConfirmed) {
      if (pending.current) {
        setSuccess({ ...pending.current, symbol: SYMBOL, hash: w.txHash });
        pending.current = null;
      }
      s.refetch();
      setActivityKey((k) => k + 1);
      w.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.isConfirmed]);

  // ---------- derived state (per position, then aggregated) ----------
  const nowSec = Math.floor(Date.now() / 1000);
  const { current: curCycle, next: nextCycle } = cyclesAround(nowSec);
  const cur = s.pool.currentEpoch > 0n ? Number(s.pool.currentEpoch) : null;
  const cycleProgress = Math.min(1, Math.max(0, (nowSec - curCycle.start) / (curCycle.end - curCycle.start)));
  const GRACE = CLAIM_BUFFER_DAYS * 86400;

  const views: PositionView[] = s.positions.map((p, i) => {
    const from = Number(p.activeFrom);
    const last = from + Number(p.periods) - 1;
    const lockEnd = Number(p.lockEnd);
    const graceEnd = lockEnd + GRACE;
    const status: PositionStatus =
      nowSec >= lockEnd ? (nowSec < graceEnd ? "grace" : "graceOver") : cur !== null && cur < from ? "queued" : "earning";
    return {
      id: p.id,
      status,
      amount: formatToken(p.amount, 2),
      months: Number(p.periods) === 1 ? cycleOfEpoch(from).label : `${cycleOfEpoch(from).label} → ${cycleOfEpoch(last).label}`,
      lockEnd: fmtDate(lockEnd),
      graceEnd: fmtDate(graceEnd),
      graceCountdown: formatCountdown(Math.max(0, graceEnd - nowSec)),
      lockCountdown: formatCountdown(Math.max(0, lockEnd - nowSec)),
      claimable: formatToken(s.positionPending[i] ?? 0n, 2),
      nextClaim:
        Number(p.periods) > 1 && status !== "grace" && status !== "graceOver"
          ? (() => {
              const m = status === "queued" ? cycleOfEpoch(from) : curCycle;
              return `${m.label.split(" ")[0]} reward: claim ${fmtDate(m.end)} → ${fmtDate(m.claimUntil)}, then every month`;
            })()
          : undefined,
    };
  });
  const sumBy = (st: PositionStatus) =>
    s.positions.reduce((acc, p, i) => (views[i].status === st ? acc + p.amount : acc), 0n);
  const countBy = (st: PositionStatus) => views.filter((v) => v.status === st).length;
  const hasStake = s.positions.length > 0;
  const graceCount = countBy("grace");
  const graceOverCount = countBy("graceOver");
  const earningCount = countBy("earning");
  const queuedCount = countBy("queued");
  const endedCount = graceCount + graceOverCount;
  const canClaim = s.pendingRewards > 0n;
  // earliest grace deadline among positions in grace
  const graceViews = s.positions
    .map((p, i) => ({ end: Number(p.lockEnd) + GRACE, i }))
    .filter((x) => views[x.i].status === "grace")
    .sort((a, b) => a.end - b.end);
  const graceRewards = graceViews.reduce((acc, x) => acc + (s.positionPending[x.i] ?? 0n), 0n);
  const firstQueued = s.positions.find((_, i) => views[i].status === "queued");

  const share = pct(s.currentWeight, s.currentTotalWeight);
  // This month's pool so far. The contract's figure already includes the dividend-pool balance
  // (auto-pulled at month end); before the contract is live, show the dividend pool itself.
  const poolNow = s.configured ? s.currentRewardSoFar : s.dividendPoolBalance;
  const estimate =
    s.currentTotalWeight > 0n ? formatToken((poolNow * s.currentWeight) / s.currentTotalWeight, 2) : "0.00";

  const staked = formatToken(s.account.staked, 2);
  const pendingStr = formatToken(s.pendingRewards, 2);
  const contractError = mapError(w.errorMessage);
  const busy = w.isSigning || (w.hasActiveTx && w.isConfirming);

  const walletBalance = wallet?.value ? formatToken(wallet.value, 4) : "0.0000";
  // "Max" keeps 0.01 reAED for gas so the stake transaction can be paid for
  const GAS_BUFFER = 10n ** 16n;
  const walletBalanceRaw = useMemo(
    () => (wallet?.value && wallet.value > GAS_BUFFER ? formatEther(wallet.value - GAS_BUFFER) : "0"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet?.value],
  );

  const stakeDisabledReason = useMemo(() => {
    if (!s.configured) return "Staking opens once the contract is live.";
    if (!s.isConnected) return "Connect wallet to stake.";
    if (s.positions.length >= 20) return "You have the maximum of 20 open positions.";
    if (!termsAccepted) return "Accept the terms to continue.";
    try {
      const parsed = parseEther(amount || "0");
      if (parsed <= 0n) return "Enter an amount.";
      if (wallet?.value !== undefined && parsed > wallet.value) return "Insufficient wallet balance.";
    } catch {
      return "Enter a valid amount.";
    }
    return null;
  }, [s.configured, s.isConnected, s.positions.length, termsAccepted, amount, wallet?.value]);

  const claimDisabledReason = !s.isConnected ? "Connect wallet to claim." : !canClaim ? "No claimable rewards right now." : null;

  // ---------- guidance (most urgent first) ----------
  const guide: GuideState = !s.configured
    ? { kind: "notConfigured" }
    : !s.isConnected
      ? { kind: "disconnected" }
      : graceCount > 0
        ? {
            kind: "grace",
            amount: formatToken(sumBy("grace"), 2),
            rewards: formatToken(graceRewards, 2),
            deadline: fmtDate(graceViews[0].end),
            countdown: formatCountdown(Math.max(0, graceViews[0].end - nowSec)),
            count: graceCount,
          }
        : canClaim
          ? {
              kind: "claim",
              amount: pendingStr,
              deadline: fmtDate(Number(s.pendingDeadline)),
              countdown: formatCountdown(claimEndsIn),
            }
          : graceOverCount > 0
            ? { kind: "graceOver", amount: formatToken(sumBy("graceOver"), 2), count: graceOverCount }
            : earningCount > 0
              ? { kind: "earning", amount: formatToken(sumBy("earning"), 2), cycle: curCycle.label, share, count: earningCount }
              : queuedCount > 0 && firstQueued
                ? {
                    kind: "queued",
                    amount: formatToken(sumBy("queued"), 2),
                    cycle: cycleOfEpoch(Number(firstQueued.activeFrom)).label,
                    start: fmtDate(cycleOfEpoch(Number(firstQueued.activeFrom)).start),
                    count: queuedCount,
                  }
                : {
                    kind: "idle",
                    nextCycle: nextCycle.label,
                    nextStart: fmtDate(nextCycle.start),
                    closesIn: formatCountdown(Math.max(0, nextCycle.start - nowSec)),
                    running: curCycle.label,
                  };

  // Default tab follows the wallet's state until the user picks one.
  const autoTab: GuideTab = endedCount > 0 ? "earning" : canClaim ? "claim" : hasStake ? "earning" : "stake";
  const activeTab: GuideTab = tab ?? autoTab;
  const setTab = (t: GuideTab) => setTabState(t);
  const goTab = (t: GuideTab) => {
    setTab(t);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------- actions ----------
  const doStake = () => {
    pending.current = { kind: "stake", amount: amount || "0" };
    w.stake(amount, periods);
  };
  const doClaim = () => {
    pending.current = { kind: "claim", amount: pendingStr };
    w.claim();
  };
  const doWithdraw = (id: bigint) => {
    const i = s.positions.findIndex((p) => p.id === id);
    const v = views[i];
    pending.current = {
      kind: "withdraw",
      amount: v && v.status === "grace" && v.claimable !== "0.00" ? `${v.amount} + ${v.claimable}` : v?.amount ?? "0",
    };
    w.withdraw(id);
  };
  const doWithdrawAll = () => {
    pending.current = { kind: "withdraw", amount: formatToken(sumBy("grace") + sumBy("graceOver"), 2) };
    w.withdrawAll();
  };

  const stats = [
    { label: "Wallet balance", value: formatToken(wallet?.value ?? 0n, 2), sub: SYMBOL, icon: icons.pool },
    { label: "Total staked", value: formatToken(s.pool.totalStaked, 2), sub: SYMBOL, icon: icons.total },
    {
      label: "Your stake",
      value: staked,
      sub: hasStake ? `${s.positions.length} ${s.positions.length === 1 ? "position" : "positions"}` : SYMBOL,
      icon: icons.yours,
    },
    { label: "Cycle ends in", value: formatCountdown(cycleEndsIn), sub: `${curCycle.label} · UTC`, icon: icons.reset },
  ];

  const explorer = appChain.blockExplorers?.default.url.replace(/\/$/, "");
  const shortPool = stakingPoolAddress ? `${stakingPoolAddress.slice(0, 6)}…${stakingPoolAddress.slice(-4)}` : null;

  const tourSteps: TourStep[] = [
    {
      title: "Welcome to the INFRA Dividend Pool",
      body: (
        <>
          <p>
            You stake <b>reAED</b> and earn a share of <b>real INFRA network fees</b>. No inflation, no new tokens and{" "}
            <b>no fixed APR</b> — what you earn depends on what the network collects and your share of the pool.
          </p>
          <div className="tour-flow">
            <span>Stake<small>this month</small></span>
            <span>Earn<small>locked months</small></span>
            <span>Pool pays<small>month end</small></span>
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
          Network fees collect in the <b>dividend pool</b> during the month. When the month closes, that balance moves to
          the staking pool automatically and is split among that month’s stakers.
        </p>
      ),
    },
    {
      target: '[data-tour="stats"]',
      title: "Your numbers at a glance",
      body: (
        <p>
          Your <b>wallet balance</b>, the pool’s <b>total staked</b>, <b>your stake</b> and its earning months, and when
          the <b>current cycle ends</b>.
        </p>
      ),
    },
    {
      target: '[data-tour="guide"]',
      title: "This banner tells you what to do",
      body: (
        <p>
          Start here on every visit. It changes with your position: <b>stake for next month</b>, <b>you’re earning</b>,{" "}
          <b>rewards ready</b>, or <b>lock ended — withdraw before the grace period ends</b>.
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
            <b>{curCycle.label} is already running</b>, so it’s closed to new stakes. The window for{" "}
            <b>{nextCycle.label}</b> is open until <b>{fmtDate(nextCycle.start - 1)}, 23:59 UTC</b>.
          </p>
          <p>
            Enter an amount and pick a <b>lock of 1–12 months</b>. You’ll see who’s already joining, your projected share,
            and exactly which months you earn in. You can open <b>several stakes</b> with different locks — each one is
            tracked as its own position.
          </p>
        </>
      ),
    },
    {
      title: "How your share is calculated",
      body: (
        <>
          <p>
            Each month: <b>your stake ÷ everyone’s stake</b> that month, applied to what the dividend pool sends at month
            end.
          </p>
          <div className="tour-eg">
            <div><span>Dividend pool at month end (example)</span><span>1,000 reAED</span></div>
            <div><span>Your stake ÷ total staked</span><span>5%</span></div>
            <div className="t"><span>Your reward</span><span>50 reAED</span></div>
          </div>
          <p className="text-[0.76rem]">Illustration only — actual rewards depend on real network fees.</p>
        </>
      ),
    },
    {
      target: '[data-tour="panel"]',
      before: () => setTab("claim"),
      title: "Claim after each month",
      body: (
        <>
          <p>
            When a month closes, that month’s reward appears here. You have <b>{CLAIM_BUFFER_DAYS} days to claim</b> it.
            Rewards not claimed in time are <b>forfeited</b>.
          </p>
          <p>
            <b>On longer locks (6 or 12 months) claim every month</b> — not just at the end. Each month’s reward has its
            own 30-day window, even while your stake is still locked.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="panel"]',
      before: () => setTab("earning"),
      title: "When your lock ends",
      body: (
        <p>
          Earning stops. You have a <b>{CLAIM_BUFFER_DAYS}-day grace period</b> to withdraw your principal{" "}
          <b>together with your rewards</b>. After that you can still withdraw your principal, but unclaimed rewards are
          forfeited.
        </p>
      ),
    },
    {
      target: '[data-tour="cycle-cards"]',
      title: "Cycle calendar",
      body: (
        <p>
          <b>Previous</b> month: claim window. <b>Current</b> month: earning, with the reward pool so far. <b>Next</b>{" "}
          month: open for new stakes. The history shows each month’s pool and your reward.
        </p>
      ),
    },
    {
      target: '[data-tour="where"]',
      title: "Next time you log in",
      body: (
        <p>
          Check the banner, or use these shortcuts: <b>My stakes</b>, <b>Claim</b> after a month closes, or <b>Stake</b>{" "}
          for next month. Replay this tour from <b>How it works</b> in the header.
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
              <span className="pd">{s.configured ? "Open" : "Soon"}</span> Staking for {nextCycle.label} · closes in{" "}
              {formatCountdown(Math.max(0, nextCycle.start - nowSec))}
            </span>
            <h1 className="text-[clamp(1.8rem,3.6vw,2.6rem)]">
              <span className="hl-line"><span>Stake reAED.</span></span>
              <span className="hl-line text-[var(--blue)]"><span style={{ ["--d" as string]: "120ms" }}>Earn network revenue.</span></span>
            </h1>
            <p className="max-w-[480px] text-[0.92rem] text-[var(--t2)]" data-rv style={{ ["--d" as string]: "200ms" }}>
              No inflation. No emissions. Each month, the network fees collected in the dividend pool are shared among
              stakers by their stake.
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

          <PoolHero
            amount={poolNow}
            dividend={s.dividendPoolBalance}
            month={curCycle.label}
            nextMonth={nextCycle.label}
            payDate={fmtDate(curCycle.end)}
            symbol={SYMBOL}
            onStake={() => goTab("stake")}
          />
        </section>

        <div data-tour="stats">
          <StatsCards cards={stats} />
        </div>

        <div className="mt-3" data-tour="guide" data-rv>
          <GuideBanner state={guide} symbol={SYMBOL} go={goTab} />
        </div>

        <section ref={tabsRef} data-rv className="mt-3 grid scroll-mt-20 grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid content-start gap-3">
            <GuideTabs
              tab={activeTab}
              setTab={setTab}
              labels={{ earning: "My stakes", claim: "Claim", stake: `Stake for ${nextCycle.label.split(" ")[0]}` }}
              dots={{ claim: canClaim, earning: endedCount > 0 }}
            />

            <div className="tab-panel grid content-start gap-3" data-tour="panel" key={activeTab}>
              {activeTab === "earning" ? (
                <>
                  {hasStake ? (
                    <PositionsPanel
                      symbol={SYMBOL}
                      totalStaked={staked}
                      count={s.positions.length}
                      cycle={curCycle.label}
                      progress={cycleProgress}
                      share={share}
                      estimate={estimate}
                      totalClaimed={formatToken(s.account.totalClaimed, 2)}
                      totalExpired={formatToken(s.account.totalExpired, 2)}
                      endedCount={endedCount}
                      positions={views}
                      onWithdraw={doWithdraw}
                      onWithdrawAll={doWithdrawAll}
                      onAdd={() => setTab("stake")}
                      busy={busy}
                      error={contractError}
                    />
                  ) : (
                    <EmptyPanel
                      label="My stakes"
                      title="You don’t have a stake yet"
                      body={`Stake now to join the ${nextCycle.label} cycle. Earning starts ${fmtDate(nextCycle.start)}.`}
                      cta={`Stake for ${nextCycle.label}`}
                      onCta={() => setTab("stake")}
                    />
                  )}
                  {s.isConnected && s.configured ? (
                    <ActivityList items={activity.items} loading={activity.loading} symbol={SYMBOL} explorer={explorer} />
                  ) : null}
                </>
              ) : null}

              {activeTab === "claim" ? (
                <>
                  <RewardsPanel
                    pendingRewards={pendingStr}
                    symbol={SYMBOL}
                    rewardExpiryIn={canClaim ? `${formatCountdown(claimEndsIn)} · by ${fmtDate(Number(s.pendingDeadline))}` : "--"}
                    onClaim={doClaim}
                    isClaimDisabled={Boolean(claimDisabledReason)}
                    claimDisabledReason={claimDisabledReason || contractError}
                    busy={busy}
                  />
                  <div className="tile !gap-2">
                    <span className="lbl"><i /> How claiming works</span>
                    <p className="text-[0.84rem] text-[var(--t2)]">
                      When a month closes, your share of that month’s reward pool becomes claimable for{" "}
                      {CLAIM_BUFFER_DAYS} days. Rewards not claimed in time are forfeited. Withdrawing after your lock
                      also pays any rewards still claimable.
                    </p>
                    <div className="row"><span>Claimed to date</span><span className="font-medium">{formatToken(s.account.totalClaimed, 2)} {SYMBOL}</span></div>
                    <div className="row"><span>Forfeited</span><span className="font-medium">{formatToken(s.account.totalExpired, 2)} {SYMBOL}</span></div>
                  </div>
                </>
              ) : null}

              {activeTab === "stake" ? (
                <StakeWindow
                  now={nowSec}
                  joining={formatToken(s.nextJoinTotal, 2)}
                  earningNow={formatToken(s.currentActiveTotal, 2)}
                  poolNow={formatToken(poolNow, 2)}
                  lastPool={formatToken(s.lastMonthPool, 2)}
                  symbol={SYMBOL}
                />
              ) : null}
              {activeTab === "stake" ? (
                (
                  <StakePanel
                    amount={amount}
                    setAmount={setAmount}
                    periods={periods}
                    setPeriods={setPeriods}
                    walletBalance={walletBalance}
                    walletBalanceRaw={walletBalanceRaw}
                    termsAccepted={termsAccepted}
                    setTermsAccepted={setTermsAccepted}
                    onStake={doStake}
                    disabledReason={stakeDisabledReason || contractError}
                    busy={busy}
                    symbol={SYMBOL}
                    nextJoinTotal={s.nextJoinTotal}
                    refPool={poolNow}
                    refLabel={`${curCycle.label.split(" ")[0]} so far`}
                    periodOptions={s.allowedPeriods}
                  />
                )
              ) : null}
            </div>
          </div>

          <div className="grid content-start gap-3">
            <div className="tile" data-tour="where">
              <span className="lbl"><i /> Where to go</span>
              <button className="row w-full text-left" onClick={() => goTab("earning")}>
                <span>Already staked?</span><span className="font-medium text-[var(--blue)]">My stakes →</span>
              </button>
              <div className="hr" />
              <button className="row w-full text-left" onClick={() => goTab("claim")}>
                <span>Month finished?</span><span className="font-medium text-[var(--blue)]">Claim rewards →</span>
              </button>
              <div className="hr" />
              <button className="row w-full text-left" onClick={() => goTab("earning")}>
                <span>Lock ended?</span><span className="font-medium text-[var(--blue)]">Withdraw within 30 days →</span>
              </button>
              <div className="hr" />
              <button className="row w-full text-left" onClick={() => goTab("stake")}>
                <span>New here?</span><span className="font-medium text-[var(--blue)]">Stake for {nextCycle.label} →</span>
              </button>
            </div>
            <WhyStake />
            <HowItWorksCard />
          </div>
        </section>

        <CycleTimeline poolNow={formatToken(poolNow, 2)} symbol={SYMBOL} />

        <SuccessOverlay state={success} explorer={explorer} onClose={closeSuccess} />

        {w.txHash && explorer ? (
          <a
            href={`${explorer}/tx/${w.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--black)] px-5 py-3 text-[0.85rem] text-white shadow-lg"
          >
            {w.isConfirming ? "Confirming transaction…" : "Transaction sent"} ·{" "}
            <span className="text-[var(--blue-l)]">View on explorer</span>
          </a>
        ) : null}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6 text-[0.8rem] text-[var(--t3)]">
          <span>
            © {new Date().getFullYear()} INFRA · Dividend Pool
          </span>
          {explorer && shortPool ? (
            <a
              href={`${explorer}/address/${stakingPoolAddress}`}
              target="_blank"
              rel="noreferrer"
              className="mono transition-colors hover:text-[var(--blue)]"
            >
              Staking contract {shortPool} ↗
            </a>
          ) : (
            <span className="mono">Staking contract: not deployed yet</span>
          )}
        </footer>
      </main>
    </>
  );
}
