"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
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
 * Admin console for the monthly routine:
 *  1) check the dividend pool → staking link, 2) send the month's rewards,
 *  3) sweep expired months to the admin wallet, 4) return abandoned stakes,
 *  5) recover surplus. Owner-only actions are disabled for other wallets.
 */
export function AdminPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const sp = { abi: stakingPoolAbi, address: stakingPoolAddress! } as const;
  const now = Math.floor(Date.now() / 1000);
  const { current, previous } = cyclesAround(now);
  const curId = epochIdOf(current);

  // ---- pool state ----
  const { data: base, refetch: refetchBase } = useReadContracts({
    contracts: [
      { ...sp, functionName: "owner" },
      { ...sp, functionName: "dividendPool" },
      { ...sp, functionName: "adminWallet" },
      { ...sp, functionName: "totalStaked" },
      { ...sp, functionName: "surplusBalance" },
      { ...sp, functionName: "totalRewardsReceived" },
      { ...sp, functionName: "totalRewardsClaimed" },
      { ...sp, functionName: "totalExpiredSwept" },
      { ...sp, functionName: "epochReward", args: [BigInt(curId)] },
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
  const { data: dvBal, refetch: refetchDvBal } = useBalance({
    address: dividend,
    query: { enabled: Boolean(dividend), refetchInterval: 15_000 },
  });

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
    return { e, label: cycleOfEpoch(e).label, reward, claimed, swept, deadline, left, sweepable, open: now < deadline && weight > 0n };
  });

  // ---- abandoned stakes (past lock + grace) from Staked events ----
  const [abandoned, setAbandoned] = useState<{ user: Address; amount: bigint; count: number }[]>([]);
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
        const out: { user: Address; amount: bigint; count: number }[] = [];
        for (const user of users) {
          const ps = (await client.readContract({ ...sp, functionName: "positionsOf", args: [user] })) as readonly {
            amount: bigint;
            lockEnd: bigint;
          }[];
          const due = ps.filter((p) => now >= Number(p.lockEnd) + CLAIM_BUFFER_DAYS * 86400);
          if (due.length) out.push({ user, amount: due.reduce((a, p) => a + p.amount, 0n), count: due.length });
        }
        if (!cancelled) setAbandoned(out);
      } catch {
        if (!cancelled) setAbandoned([]);
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, scanKey]);

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

  const [sendAmt, setSendAmt] = useState("");
  const [surplusAmt, setSurplusAmt] = useState("");
  const dvBalance = dvBal?.value ?? 0n;
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
            <span className="lbl b"><i /> Admin console</span>
            <h1 className="mt-2 text-[clamp(1.5rem,3vw,2rem)]">Monthly operations</h1>
          </div>
          <span className={`st ${isOwner ? "st-active" : "st-closed"}`}>
            {address ? (isOwner ? "Connected as staking owner" : "Not the owner — view only") : "Connect the owner wallet"}
          </span>
        </div>

        {/* 1. Setup & link */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> 1 · Setup</span>
          <div className="adm-grid">
            <div><span>Staking contract</span><b className="mono">{short(stakingPoolAddress)}</b></div>
            <div><span>Owner</span><b className="mono">{short(owner)}</b></div>
            <div><span>Dividend pool</span><b className="mono">{short(dividend)}</b></div>
            <div><span>Admin wallet (expired rewards)</span><b className="mono">{short(adminWallet)}</b></div>
          </div>
          <div className="row mt-1">
            <span>Dividend pool sends to this staking contract?</span>
            <span className={`st ${linked ? "st-active" : "st-claim"}`}>{linkedTo === undefined ? "Checking…" : linked ? "Linked" : `No — points to ${short(linkedTo)}`}</span>
          </div>
          {!linked && linkedTo !== undefined ? (
            <button
              className="btn btn-b btn-sm justify-self-start"
              disabled={!isDvOwner || busy}
              onClick={() => writeContract({ ...dp, functionName: "setStakingContract", args: [stakingPoolAddress!] })}
            >
              Link dividend pool → staking {isDvOwner ? "" : "(dividend pool owner only)"}
            </button>
          ) : null}
        </div>

        {/* 2. Month-end rewards */}
        <div className="tile !gap-2.5">
          <span className="lbl"><i /> 2 · Send this month’s rewards</span>
          <div className="adm-grid">
            <div><span>Dividend pool balance</span><b>{formatToken(dvBalance, 2)} {SYMBOL}</b></div>
            <div><span>Already in {current.label} pool</span><b>{formatToken(big(8), 2)} {SYMBOL}</b></div>
            <div><span>Sent to staking (lifetime)</span><b>{formatToken((dv?.[3]?.result as bigint) ?? 0n, 2)} {SYMBOL}</b></div>
            <div><span>Window</span><b>Before {fmtDate(current.end - 1)} 23:59 UTC</b></div>
          </div>
          <p className="text-[0.82rem] text-[var(--t2)]">
            Anything sent now is credited to <b>{current.label}</b> and split among its stakers when the month closes.
            Send on the last day before 00:00 UTC.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="field !py-1.5 min-w-[220px] flex-1">
              <input value={sendAmt} onChange={(e) => setSendAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount" />
              <button className="btn btn-k !h-7 !px-3 !text-[0.75rem]" onClick={() => setSendAmt(formatEther(dvBalance))}>All</button>
            </div>
            <button
              className="btn btn-b"
              disabled={!isDvOwner || !linked || busy || !sendAmt || Number(sendAmt) <= 0}
              onClick={() => writeContract({ ...dp, functionName: "sendRewardsToStaking", args: [parseEther(sendAmt)] })}
            >
              Send to staking
            </button>
          </div>
          {!isDvOwner && address ? <p className="text-[0.76rem] text-[var(--t3)]">Only the dividend pool owner ({short(dvOwner)}) can send.</p> : null}
        </div>

        {/* 3. Expired months */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> 3 · Expired rewards → admin wallet</span>
          <p className="text-[0.82rem] text-[var(--t2)]">
            After a month’s {CLAIM_BUFFER_DAYS}-day claim window, unclaimed rewards can be swept to the admin wallet. Anyone can trigger it; funds only go to {short(adminWallet)}.
          </p>
          <div className="overflow-x-auto">
            <table className="cyc !min-w-[640px]">
              <thead>
                <tr><th>Month</th><th>Pool</th><th>Claimed</th><th>Unclaimed</th><th>Claim until</th><th /></tr>
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
                      {m.sweepable ? (
                        <button className="btn btn-k btn-sm !h-8" disabled={busy} onClick={() => writeContract({ ...sp, functionName: "sweepExpired", args: [BigInt(m.e)] })}>
                          Sweep {formatToken(m.left, 2)}
                        </button>
                      ) : (
                        <span className="mono text-[0.7rem] text-[var(--t3)]">{m.swept ? "done" : m.open ? "claim open" : "—"}</span>
                      )}
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
            <span className="lbl"><i /> 4 · Return abandoned stakes</span>
            <button className="text-[0.8rem] text-[var(--blue)]" onClick={() => setScanKey((k) => k + 1)}>{scanning ? "Scanning…" : "Rescan"}</button>
          </div>
          <p className="text-[0.82rem] text-[var(--t2)]">
            Positions past lock + {CLAIM_BUFFER_DAYS}-day grace that the owner never withdrew. Releasing sends the principal to each staker’s own wallet (rewards were already forfeited).
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
              <button
                className="btn btn-b btn-sm justify-self-start"
                disabled={busy}
                onClick={() => writeContract({ ...sp, functionName: "releaseStakes", args: [abandoned.map((a) => a.user)] })}
              >
                Release all ({abandoned.length} wallets)
              </button>
            </>
          )}
        </div>

        {/* 5. Totals & surplus */}
        <div className="tile !gap-2">
          <span className="lbl"><i /> 5 · Totals & surplus</span>
          <div className="adm-grid">
            <div><span>Total staked (principal)</span><b>{formatToken(big(3), 2)} {SYMBOL}</b></div>
            <div><span>Rewards received</span><b>{formatToken(big(5), 2)} {SYMBOL}</b></div>
            <div><span>Rewards claimed</span><b>{formatToken(big(6), 2)} {SYMBOL}</b></div>
            <div><span>Expired swept to admin</span><b>{formatToken(big(7), 2)} {SYMBOL}</b></div>
          </div>
          <div className="row"><span>Surplus (balance − principal, includes unclaimed rewards)</span><b>{formatToken(big(4), 2)} {SYMBOL}</b></div>
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
        </div>

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
