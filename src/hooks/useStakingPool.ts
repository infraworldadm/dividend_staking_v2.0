"use client";

import { useMemo } from "react";
import { parseEther } from "viem";
import { useAccount, useBalance, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { isStakingConfigured, stakingPoolAbi, stakingPoolAddress } from "@/lib/web3/contract";
import type { EpochChain, PoolState, StakeUser } from "@/types/contract";
import { cyclesAround, epochIdOf } from "@/lib/cycles";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const big = (v: unknown) => (typeof v === "bigint" ? v : 0n);

/** All live reads the page needs from InfraStakingPool (+ dividend pool balance). Refreshes every 10s. */
export function useStakingPool() {
  const { address, isConnected } = useAccount();
  const who = address ?? ZERO;
  const base = { abi: stakingPoolAbi, address: stakingPoolAddress! } as const;
  const around = cyclesAround(Math.floor(Date.now() / 1000));
  const nextId = BigInt(epochIdOf(around.next));
  const prevId = BigInt(epochIdOf(around.previous));
  const nextSeconds = BigInt(around.next.end - around.next.start);

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...base, functionName: "totalStaked" },
      { ...base, functionName: "currentEpoch" },
      { ...base, functionName: "dividendPool" },
      { ...base, functionName: "totalRewardsClaimed" },
      { ...base, functionName: "users", args: [who] },
      { ...base, functionName: "pendingRewards", args: [who] },
      { ...base, functionName: "currentEpochShare", args: [who] },
      { ...base, functionName: "graceEnd", args: [who] },
      { ...base, functionName: "totalWeight", args: [nextId] },
      { ...base, functionName: "epochReward", args: [prevId] },
    ],
    query: { enabled: isStakingConfigured, refetchInterval: 10_000 },
  });

  const pool = useMemo<PoolState>(
    () => ({
      totalStaked: big(data?.[0]?.result),
      currentEpoch: big(data?.[1]?.result),
      dividendPool: data?.[2]?.result as `0x${string}` | undefined,
      totalRewardsClaimed: big(data?.[3]?.result),
    }),
    [data],
  );

  const user = useMemo<StakeUser>(() => {
    const u = (data?.[4]?.result as readonly unknown[] | undefined) ?? [];
    return {
      amount: big(u[0]),
      stakedAt: big(u[1]),
      periods: big(u[2]),
      activeFrom: big(u[3]),
      lockEnd: big(u[4]),
      lastSettledEpoch: big(u[5]),
      totalClaimed: big(u[6]),
      totalExpired: big(u[7]),
    };
  }, [data]);

  const pending = (data?.[5]?.result as readonly [bigint, bigint] | undefined) ?? [0n, 0n];
  const share = (data?.[6]?.result as readonly [bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n];

  // Live balance of the dividend pool = rewards waiting to be sent at month end.
  const { data: dividendBal, refetch: refetchDiv } = useBalance({
    address: pool.dividendPool,
    query: { enabled: Boolean(pool.dividendPool), refetchInterval: 10_000 },
  });

  return {
    configured: isStakingConfigured,
    address,
    isConnected,
    isLoading,
    pool,
    user,
    pendingRewards: pending[0],
    pendingDeadline: pending[1],
    currentWeight: share[1],
    currentTotalWeight: share[2],
    currentRewardSoFar: share[3],
    graceEnd: big(data?.[7]?.result),
    /** principal already scheduled to earn next month */
    nextJoinTotal: big(data?.[8]?.result) / nextSeconds,
    /** principal earning in the running month */
    currentActiveTotal: share[2] / BigInt(around.current.end - around.current.start),
    lastMonthPool: big(data?.[9]?.result),
    dividendPoolBalance: dividendBal?.value ?? 0n,
    refetch: () => {
      refetch();
      refetchDiv();
    },
  };
}

/** Per-month on-chain data for the history table: pool, claimed, swept, and the wallet's own reward. */
export function useEpochHistory(epochs: number[]) {
  const { address } = useAccount();
  const who = address ?? ZERO;
  const base = { abi: stakingPoolAbi, address: stakingPoolAddress! } as const;
  const { data } = useReadContracts({
    contracts: epochs.flatMap((e) => [
      { ...base, functionName: "epochInfo", args: [BigInt(e)] } as const,
      { ...base, functionName: "userEpochReward", args: [who, BigInt(e)] } as const,
    ]),
    query: { enabled: isStakingConfigured && epochs.length > 0, refetchInterval: 30_000 },
  });
  return useMemo(() => {
    const out: Record<number, EpochChain> = {};
    epochs.forEach((e, i) => {
      const info = data?.[i * 2]?.result as readonly unknown[] | undefined;
      if (!info) return;
      out[e] = { reward: big(info[3]), claimed: big(info[5]), swept: Boolean(info[6]), mine: big(data?.[i * 2 + 1]?.result) };
    });
    return out;
  }, [data, epochs]);
}

function errMsg(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "object" && err && "shortMessage" in err && typeof err.shortMessage === "string") return err.shortMessage;
  return err instanceof Error ? err.message : String(err);
}

/** stake / claim / withdraw transactions. */
export function useStakingWrites() {
  const { writeContract, data: txHash, error, isPending: isSigning, reset } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });
  const base = { abi: stakingPoolAbi, address: stakingPoolAddress! } as const;
  return {
    stake: (amount: string, periods: number) =>
      writeContract({ ...base, functionName: "stake", args: [BigInt(periods)], value: parseEther(amount || "0") }),
    claim: () => writeContract({ ...base, functionName: "claim" }),
    withdraw: () => writeContract({ ...base, functionName: "withdraw" }),
    txHash,
    hasActiveTx: Boolean(txHash),
    isSigning,
    isConfirming: Boolean(txHash) && tx.isPending,
    isConfirmed: tx.isSuccess,
    errorMessage: errMsg(error),
    reset,
  };
}
