"use client";

/**
 * @file Admin analytics dashboard: pool totals, stakers, lock-length breakdown, unlock schedule, monthly payouts and automation status. Manual on-chain overrides are collapsed and wallet-gated.
 */
import { useEffect, useMemo, useState } from "react";
import { parseEther, type Address } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Header } from "@/components/staking/Header";
import { CLAIM_BUFFER_DAYS, cycleOfEpoch, cyclesAround, epochIdOf, fmtDate } from "@/lib/cycles";
import { formatToken } from "@/lib/format";
import { appChain } from "@/lib/web3/chains";
import { isStakingConfigured, stakingPoolAbi, stakingPoolAddress } from "@/lib/web3/contract";
import { dividendPoolAbi } from "@/lib/web3/dividendAbi";

const SYMBOL = "ReAED";
const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

/**
 * Admin analytics (behind the username/password login).
 * Payouts are AUTOMATIC on-chain: the dividend pool is pulled at month start and expired
 * rewards are swept to the admin wallet — nobody has to sign anything monthly.
 * Owner-wallet tools live in the collapsed "Manual overrides" section only.
 */
export function AdminPage() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((j: { user?: string | null }) => setMe(j.user ?? null))
      .catch(() => setMe(null));
  }, []);
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };
  const { address } = useAccount();
  const client = usePublicClient();
  const sp = { abi: stakingPoolAbi, address: stakingPoolAddress! } as const;
  const now = Math.floor(Date.now() / 1000);
  const { current, previous } = cyclesAround(now);
  const curId = epochIdOf(current);

  // ---- pool state ----
  // Pool-level reads; `r(i)` / `big(i)` below index into this list.
  const { data: base, refetch: refetchBase } = useReadContracts({
    contracts: [
      { ...sp, functionName: "owner" }, // [0]
      { ...sp, functionName: "dividendPool" }, // [1]
      { ...sp, functionName: "adminWallet" }, // [2]
      { ...sp, functionName: "totalStaked" }, // [3]
      { ...sp, functionName: "surplusBalance" }, // [4]
      { ...sp, functionName: "totalRewardsReceived" }, // [5]
      { ...sp, functionName: "totalRewardsClaimed" }, // [6]
      { ...sp, functionName: "totalExpiredSwept" }, // [7]
      { ...sp, functionName: "epochReward", args: [BigInt(curId)] }, // [8]
      { ...sp, functionName: "stakerCount" }, // [9]
      { ...sp, functionName: "openPositions" }, // [10]
      { ...sp, functionName: "allowedPeriods" }, // [11]
      { ...sp, functionName: "totalWeight", args: [BigInt(curId)] }, // [12]
      { ...sp, functionName: "rewardOf", args: [BigInt(curId)] }, // [13]
      { ...sp, functionName: "autoPullEnabled" }, // [14]
      { ...sp, functionName: "lastPulledEpoch" }, // [15]
      { ...sp, functionName: "nextSweepEpoch" }, // [16]
      { ...sp, functionName: "needsPoke" }, // [17]
    ],
    query: { enabled: isStakingConfigured, refetchInterval: 15_000 },
  });
  const r = (i: number) => base?.[i]?.result;
  const owner = r(0) as Address | undefined;
  const dividend = r(1) as Address | undefined;
  const adminWallet = r(2) as Address | undefined;
  const big = (i: number) => (typeof r(i) === "bigint" ? (r(i) as bigint) : 0n);

  const dp = { abi: dividendPoolAbi, address: dividend! } as const;
  const { data: dv, refetch: refetchDv } = useReadContracts({
    contracts: [
      { ...dp, functionName: "owner" },
      { ...dp, functionName: "stakingContract" },
      { ...dp, functionName: "totalReceived" },
      { ...dp, functionName: "totalRewardsSentToStaking" },
    ],
    query: { enabled: Boolean(dividend), refetchInterval: 15_000 },
  });
  const dvOwner = dv?.[0]?.result as Address | undefined;
  const linkedTo = dv?.[1]?.result as Address | undefined;
  const { refetch: refetchDvBal } = useBalance({
    address: dividend,
    query: { enabled: Boolean(dividend), refetchInterval: 15_000 },
  });

  const { data: poolBal } = useBalance({ address: stakingPoolAddress, query: { refetchInterval: 15_000 } });
  const soFar = big(13);
  const autoPull = r(14) as boolean | undefined;
  const lastPulled = Number(big(15));
  const nextSweep = Number(big(16));
  const needsPoke = r(17) as boolean | undefined;
  const allowed = ((r(11) as readonly bigint[] | undefined) ?? []).map(Number);
  const isOwner = same(address, owner);
  const isDvOwner = same(address, dvOwner);
  const linked = same(linkedTo, stakingPoolAddress);

  // ---- closed months (last 12) ----
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => curId - 1 - i), [curId]);
  const { data: ep, refetch: refetchEp } = useReadContracts({
    contracts: months.map((e) => ({ ...sp, functionName: "epochInfo", args: [BigInt(e)] }) as const),
    query: { enabled: isStakingConfigured, refetchInterval: 30_000 },
  });
  const monthRows = months.map((e, i) => {
    const x = ep?.[i]?.result as readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean] | undefined;
    const reward = x?.[3] ?? 0n;
    const weight = x?.[4] ?? 0n;
    const claimed = x?.[5] ?? 0n;
    const swept = x?.[6] ?? false;
    const deadline = Number(x?.[2] ?? 0n);
    const left = reward - claimed;
    const sweepable = !swept && left > 0n && (now >= deadline || weight === 0n);
    return { e, label: cycleOfEpoch(e).label, reward, claimed, swept, deadline, left, sweepable, weight, open: now < deadline && weight > 0n };
  });

  // ---- every open position (from Staked events → positionsOf) ----
  type Pos = { user: Address; amount: bigint; periods: number; activeFrom: number; lockEnd: number };
  const [allPos, setAllPos] = useState<Pos[]>([]);
  const [scanKey, setScanKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    if (!client || !isStakingConfigured) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      try {
        const ev = stakingPoolAbi.find((x) => x.type === "event" && x.name === "Staked") as never;
        const logs = (await client.getLogs({ address: stakingPoolAddress!, event: ev, fromBlock: 0n, toBlock: "latest" })) as unknown as {
          args: { user: Address };
        }[];
        const users = Array.from(new Set(logs.map((l) => l.args.user)));
        const out: Pos[] = [];
        for (const user of users) {
          const ps = (await client.readContract({ ...sp, functionName: "positionsOf", args: [user] })) as readonly {
            amount: bigint;
            periods: bigint;
            activeFrom: bigint;
            lockEnd: bigint;
          }[];
          ps.forEach((p) =>
            out.push({ user, amount: p.amount, periods: Number(p.periods), activeFrom: Number(p.activeFrom), lockEnd: Number(p.lockEnd) }),
          );
        }
        if (!cancelled) setAllPos(out);
      } catch {
        if (!cancelled) setAllPos([]);
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, scanKey]);

  const GRACE = CLAIM_BUFFER_DAYS * 86400;
  type St = "queued" | "earning" | "grace" | "abandoned";
  const statusOf = (p: Pos): St =>
    now >= p.lockEnd + GRACE ? "abandoned" : now >= p.lockEnd ? "grace" : curId < p.activeFrom ? "queued" : "earning";
  const sum = (xs: Pos[]) => xs.reduce((a, p) => a + p.amount, 0n);
  const byStatus = (st: St) => allPos.filter((p) => statusOf(p) === st);
  const byPeriod = Array.from(new Set([...allowed, ...allPos.map((p) => p.periods)]))
    .sort((a, b) => a - b)
    .map((m) => ({ m, list: allPos.filter((p) => p.periods === m) }));
  // principal unlocking per month (lockEnd = 1st of that month); 13 months covers the longest lock (12) + joining month
  const schedule = Array.from({ length: 13 }, (_, k) => cycleOfEpoch(curId + 1 + k)).map((c) => {
    const list = allPos.filter((p) => p.lockEnd === c.start);
    return { label: c.label, start: c.start, list };
  });
  const stakers = Array.from(new Set(allPos.map((p) => p.user))).map((user) => {
    const list = allPos.filter((p) => p.user === user);
    const nextUnlock = list.map((p) => p.lockEnd).filter((t) => t > now).sort((a, b) => a - b)[0];
    const states = list.map(statusOf);
    const worst: St = states.includes("abandoned") ? "abandoned" : states.includes("grace") ? "grace" : states.includes("earning") ? "earning" : "queued";
    return { user, list, total: sum(list), nextUnlock, worst };
  }).sort((a, b) => (b.total > a.total ? 1 : -1));
  const abandoned = stakers
    .map((x) => ({ user: x.user, list: x.list.filter((p) => statusOf(p) === "abandoned") }))
    .filter((x) => x.list.length)
    .map((x) => ({ user: x.user, amount: sum(x.list), count: x.list.length }));
  const ST_CHIP: Record<St, string> = { queued: "st-next", earning: "st-active", grace: "st-claim", abandoned: "st-closed" };
  const ST_TEXT: Record<St, string> = { queued: "Starts next month", earning: "Earning", grace: "In grace", abandoned: "Past grace" };

  // ---- writes ----
  const { writeContract, data: hash, error, isPending, reset } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash });
  const busy = isPending || (Boolean(hash) && tx.isPending);
  useEffect(() => {
    if (tx.isSuccess) {
      refetchBase();
      refetchDv();
      refetchDvBal();
      refetchEp();
      setScanKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.isSuccess]);
  const errMsg = error ? ((error as { shortMessage?: string }).shortMessage ?? error.message) : null;

  const [surplusAmt, setSurplusAmt] = useState("");
  const nextPay = cycleOfEpoch(curId + 1);
  const owedOpen = monthRows.filter((m) => m.open && !m.swept).reduce((a, m) => a + m.left, 0n);
  const explorer = appChain.blockExplorers?.default.url.replace(/\/$/, "");

  if (!isStakingConfigured) {
    return (
      <>
        <Header />
        <main className="wrap py-10">
          <div className="tile">
            <span className="lbl"><i /> Admin</span>
            <p className="text-[var(--t2)]">Set NEXT_PUBLIC_STAKING_POOL_ADDRESS to use the admin console.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="wrap grid gap-3 pb-12 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="lbl b"><i /> Admin · analytics</span>
            <h1 className="mt-2 text-[clamp(1.5rem,3vw,2rem)]">Staking pool overview</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="st st-active">Payouts automatic</span>
            {me ? <span className="mono text-[0.75rem] text-[var(--t3)]">{me}</span> : null}
            <button className="btn btn-k btn-sm !h-8" onClick={logout}>Log out</button>
          </div>
        </div>

        {/* 0. Overview */}
        <div className="tile !gap-2.5">
          <span className="lbl"><i /> Overview · {current.label}</span>
          <div className="adm-grid">
            <div><span>Stakers (wallets)</span><b>{String(r(9) ?? 0n)}</b></div>
            <div><span>Open positions</span><b>{String(r(10) ?? 0n)}</b></div>
            <div><span>Total staked (principal)</span><b>{formatToken(big(3), 2)} {SYMBOL}</b></div>
            <div><span>Staking contract balance</span><b>{formatToken(poolBal?.value ?? 0n, 2)} {SYMBOL}</b></div>
            <div><span>Earning in {current.label}</span><b>{formatToken(sum(byStatus("earning")), 2)} {SYMBOL}</b></div>
            <div><span>Joining next month</span><b>{formatToken(sum(byStatus("queued")), 2)} {SYMBOL}</b></div>
            <div><span>{current.label} reward pool so far</span><b>{formatToken(soFar, 2)} {SYMBOL}</b><small>auto-paid {fmtDate(nextPay.start)}</small></div>
            <div><span>Unclaimed, still claimable</span><b>{formatToken(owedOpen, 2)} {SYMBOL}</b><small>owed to stakers</small></div>
          </div>
          <div className="adm-grid">
            <div><span>Withdrawable now (in grace)</span><b>{formatToken(sum(byStatus("grace")), 2)} {SYMBOL}</b><small>{byStatus("grace").length} positions</small></div>
            <div><span>Past grace (to release)</span><b>{formatToken(sum(byStatus("abandoned")), 2)} {SYMBOL}</b><small>{byStatus("abandoned").length} positions</small></div>
            <div><span>Unlocking next month</span><b>{formatToken(sum(schedule[0].list), 2)} {SYMBOL}</b><small>on {fmtDate(schedule[0].start)}</small></div>
            <div><span>Rewards held (surplus)</span><b>{formatToken(big(4), 2)} {SYMBOL}</b><small>incl. unclaimed</small></div>
          </div>
        </div>

        {/* Lock lengths + release schedule */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="tile !gap-2">
            <span className="lbl"><i /> Stakes by lock length</span>
            <table className="cyc !mt-0 !min-w-0">
              <thead><tr><th>Lock</th><th>Positions</th><th>Amount</th><th>New stakes</th></tr></thead>
              <tbody>
                {byPeriod.map(({ m, list }) => (
                  <tr key={m}>
                    <td className="font-medium">{m} {m === 1 ? "month" : "months"}</td>
                    <td className="mono">{list.length}</td>
                    <td className="mono">{formatToken(sum(list), 2)}</td>
                    <td>
                      <button
                        className={`st ${allowed.includes(m) ? "st-active" : "st-closed"}`}
                        disabled={!isOwner || busy}
                        title={isOwner ? "Click to toggle" : "Owner only"}
                        onClick={() => writeContract({ ...sp, functionName: "setAllowedPeriod", args: [BigInt(m), !allowed.includes(m)] })}
                      >
                        {allowed.includes(m) ? "Offered" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-[var(--t3)]">
                Add lock option:
                {Array.from({ length: 12 }, (_, k) => k + 1)
                  .filter((m) => !allowed.includes(m))
                  .map((m) => (
                    <button key={m} className="st st-next" disabled={busy} onClick={() => writeContract({ ...sp, functionName: "setAllowedPeriod", args: [BigInt(m), true] })}>
                      + {m}m
                    </button>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="tile !gap-2">
            <span className="lbl"><i /> Release schedule (principal unlocking)</span>
            <table className="cyc !mt-0 !min-w-0">
              <thead><tr><th>Unlocks on</th><th>Positions</th><th>Amount</th><th>Grace until</th></tr></thead>
              <tbody>
                {schedule.filter((x) => x.list.length).length === 0 ? (
                  <tr><td colSpan={4} className="mono text-[var(--t3)]">{scanning ? "Scanning…" : "No unlocks in the next 13 months."}</td></tr>
                ) : (
                  schedule.filter((x) => x.list.length).map((x) => (
                    <tr key={x.start}>
                      <td className="font-medium">{fmtDate(x.start)}</td>
                      <td className="mono">{x.list.length}</td>
                      <td className="mono">{formatToken(sum(x.list), 2)}</td>
                      <td>{fmtDate(x.start + GRACE)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stakers */}
        <div className="tile !gap-2">
          <div className="flex items-center justify-between">
            <span className="lbl"><i /> Stakers · {stakers.length}</span>
            <button className="text-[0.8rem] text-[var(--blue)]" onClick={() => setScanKey((k) => k + 1)}>{scanning ? "Scanning…" : "Rescan"}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="cyc !mt-0 !min-w-[720px]">
              <thead><tr><th>Wallet</th><th>Positions</th><th>Staked</th><th>Locks</th><th>Next unlock</th><th>Status</th></tr></thead>
              <tbody>
                {stakers.length === 0 ? (
                  <tr><td colSpan={6} className="mono text-[var(--t3)]">{scanning ? "Scanning…" : "No open positions."}</td></tr>
                ) : (
                  stakers.map((x) => (
                    <tr key={x.user}>
                      <td className="mono">
                        {explorer ? <a className="hover:text-[var(--blue)]" href={`${explorer}/address/${x.user}`} target="_blank" rel="noreferrer">{short(x.user)}</a> : short(x.user)}
                      </td>
                      <td className="mono">{x.list.length}</td>
                      <td className="mono">{formatToken(x.total, 2)}</td>
                      <td className="mono">{Array.from(new Set(x.list.map((p) => p.periods))).sort((a, b) => a - b).map((m) => `${m}m`).join(", ")}</td>
                      <td>{x.nextUnlock ? fmtDate(x.nextUnlock) : "—"}</td>
                      <td><span className={`st ${ST_CHIP[x.worst]}`}>{ST_TEXT[x.worst]}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Automation status */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> Automation (no admin action needed)</span>
          <div className="adm-grid">
            <div><span>Auto-pull from dividend pool</span><b>{autoPull === undefined ? "—" : autoPull ? "On" : "Off"}</b><small>at the start of each month</small></div>
            <div><span>Last month paid out</span><b>{lastPulled ? cycleOfEpoch(lastPulled - 1).label : "—"}</b></div>
            <div><span>Next payout</span><b>{nextPay.label.split(" ")[0]} 1</b><small>{current.label} pool → {current.label} stakers</small></div>
            <div><span>Expired-reward sweeper</span><b>{nextSweep ? `from ${cycleOfEpoch(nextSweep).label}` : "—"}</b><small>→ {short(adminWallet)}</small></div>
          </div>
          <div className="row">
            <span>Dividend pool linked to this staking contract</span>
            <span className={`st ${linked ? "st-active" : "st-claim"}`}>{linkedTo === undefined ? "Checking…" : linked ? "Linked" : `No — points to ${short(linkedTo)}`}</span>
          </div>
          <div className="row">
            <span>Pending automation step</span>
            <span className={`st ${needsPoke ? "st-claim" : "st-active"}`}>{needsPoke ? "Runs with the next transaction / daily keeper" : "Up to date"}</span>
          </div>
          <p className="text-[0.76rem] text-[var(--t3)]">
            The first transaction of a new month (any stake, claim or withdraw — or the daily keeper) moves the dividend pool
            balance into the month that just closed. Rewards unclaimed after {CLAIM_BUFFER_DAYS} days go to the admin wallet automatically.
          </p>
        </div>

        {/* 3. Expired months */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> Monthly payouts</span>
          <p className="text-[0.82rem] text-[var(--t2)]">
            Each closed month: pool paid in, claimed by stakers, and what is left. After {CLAIM_BUFFER_DAYS} days the rest goes to {short(adminWallet)} automatically.
          </p>
          <div className="overflow-x-auto">
            <table className="cyc !min-w-[640px]">
              <thead>
                <tr><th>Month</th><th>Pool</th><th>Claimed</th><th>Unclaimed</th><th>Claim until</th><th>Status</th></tr>
              </thead>
              <tbody>
                {monthRows.map((m) => (
                  <tr key={m.e}>
                    <td className="font-medium">{m.label}</td>
                    <td className="mono">{formatToken(m.reward, 2)}</td>
                    <td className="mono">{formatToken(m.claimed, 2)}</td>
                    <td className="mono">{m.swept ? "swept" : formatToken(m.left, 2)}</td>
                    <td>{m.deadline ? fmtDate(m.deadline) : "—"}</td>
                    <td>
                      <span className={`st ${m.swept ? "st-closed" : m.open ? "st-claim" : m.sweepable ? "st-next" : "st-closed"}`}>
                        {m.swept ? "Closed · rest to admin" : m.open ? "Claim open" : m.sweepable ? "Auto-sweep pending" : m.reward === 0n ? "No pool" : "Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Abandoned stakes */}
        <div className="tile !gap-2">
          <div className="flex items-center justify-between">
            <span className="lbl"><i /> Stakes past grace</span>
            <button className="text-[0.8rem] text-[var(--blue)]" onClick={() => setScanKey((k) => k + 1)}>{scanning ? "Scanning…" : "Rescan"}</button>
          </div>
          <p className="text-[0.82rem] text-[var(--t2)]">
            Positions past lock + {CLAIM_BUFFER_DAYS}-day grace not yet withdrawn. The principal stays safe — the staker can withdraw it any time (rewards were forfeited).
          </p>
          {abandoned.length === 0 ? (
            <p className="mono text-[0.78rem] text-[var(--t3)]">{scanning ? "Scanning stakers…" : "None right now."}</p>
          ) : (
            <>
              <ul className="act">
                {abandoned.map((a) => (
                  <li key={a.user}>
                    <span className="t mono">{short(a.user)}</span>
                    <span className="a mono">{formatToken(a.amount, 2)} {SYMBOL}</span>
                    <span className="d">{a.count} position{a.count > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* 5. Totals & surplus */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> Lifetime totals</span>
          <div className="adm-grid">
            <div><span>Total staked (principal)</span><b>{formatToken(big(3), 2)} {SYMBOL}</b></div>
            <div><span>Rewards received</span><b>{formatToken(big(5), 2)} {SYMBOL}</b></div>
            <div><span>Rewards claimed</span><b>{formatToken(big(6), 2)} {SYMBOL}</b></div>
            <div><span>Expired swept to admin</span><b>{formatToken(big(7), 2)} {SYMBOL}</b></div>
          </div>
          <div className="row"><span>Surplus (balance − principal, includes unclaimed rewards)</span><b>{formatToken(big(4), 2)} {SYMBOL}</b></div>
        </div>

        {/* Manual overrides (owner wallet) — normally never needed */}
        <details className="tile !gap-2">
          <summary className="cursor-pointer text-[0.85rem] font-medium">Manual overrides (wallet signature required) — normally not needed</summary>
          <p className="text-[0.76rem] text-[var(--t3)]">
            {address ? (isOwner ? "Connected as staking owner." : `Connected wallet is not the owner (${short(owner)}). Only “Run automation now” and “Release” work from any wallet.`) : "Connect a wallet to use these."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-k btn-sm" disabled={!address || busy || !needsPoke} onClick={() => writeContract({ ...sp, functionName: "poke" })}>
              Run automation now
            </button>
            <button className="btn btn-k btn-sm" disabled={!address || busy || abandoned.length === 0} onClick={() => writeContract({ ...sp, functionName: "releaseStakes", args: [abandoned.map((a) => a.user)] })}>
              Release past-grace stakes ({abandoned.length})
            </button>
            {!linked && linkedTo !== undefined ? (
              <button className="btn btn-k btn-sm" disabled={!isDvOwner || busy} onClick={() => writeContract({ ...dp, functionName: "setStakingContract", args: [stakingPoolAddress!] })}>
                Link dividend pool → staking
              </button>
            ) : null}
            <button className="btn btn-k btn-sm" disabled={!isOwner || busy} onClick={() => writeContract({ ...sp, functionName: "setAutoPull", args: [!autoPull] })}>
              Turn auto-pull {autoPull ? "off" : "on"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="field !py-1.5 min-w-[220px] flex-1">
              <input value={surplusAmt} onChange={(e) => setSurplusAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount to recover" />
            </div>
            <button
              className="btn btn-k"
              disabled={!isOwner || busy || !surplusAmt || Number(surplusAmt) <= 0 || !adminWallet}
              onClick={() => writeContract({ ...sp, functionName: "ownerWithdrawRewards", args: [adminWallet!, parseEther(surplusAmt)] })}
            >
              Withdraw to admin wallet
            </button>
          </div>
          <p className="text-[0.74rem] text-[var(--t3)]">
            Careful: surplus also holds rewards stakers can still claim. Withdrawing those makes their claims fail until refunded.
          </p>
        </details>

        {hash ? (
          <div className="tile !gap-1">
            <div className="row">
              <span>{tx.isSuccess ? "Transaction confirmed" : tx.isError ? "Transaction failed" : "Waiting for confirmation…"}</span>
              {explorer ? <a className="text-[var(--blue)]" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View ↗</a> : null}
            </div>
            <button className="text-[0.78rem] text-[var(--t3)] justify-self-start" onClick={() => reset()}>Dismiss</button>
          </div>
        ) : null}
        {errMsg ? <p className="err">{errMsg}</p> : null}
        <p className="mono text-[0.7rem] text-[var(--t3)]">Previous closed month: {previous.label}. Times in UTC.</p>
      </main>
    </>
  );
}
