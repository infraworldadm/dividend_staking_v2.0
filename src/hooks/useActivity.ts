"use client";

/**
 * @file Reads the connected wallet's Staked / Claimed / Withdrawn events and returns a sorted activity list.
 */
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { stakingPoolAbi, stakingPoolAddress, isStakingConfigured } from "@/lib/web3/contract";

export type ActivityItem = {
  kind: "stake" | "claim" | "withdraw" | "forfeit";
  amount: bigint;
  extra?: bigint; // reward paid with a withdraw (from the matching Claimed log), periods for stake
  time: number;
  hash: `0x${string}`;
};

/** The wallet's own history from contract events: stakes, claims, withdrawals, forfeits. */
export function useActivity(user?: `0x${string}`, refreshKey = 0) {
  const client = usePublicClient();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client || !user || !isStakingConfigured) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const common = { address: stakingPoolAddress!, fromBlock: 0n, toBlock: "latest" as const };
        const ev = (name: string) => stakingPoolAbi.find((x) => x.type === "event" && x.name === name) as never;
        const [staked, claimed, withdrawn, expired] = await Promise.all([
          client.getLogs({ ...common, event: ev("Staked"), args: { user } as never }),
          client.getLogs({ ...common, event: ev("Claimed"), args: { user } as never }),
          client.getLogs({ ...common, event: ev("Withdrawn"), args: { user } as never }),
          client.getLogs({ ...common, event: ev("RewardsExpiredForUser"), args: { user } as never }),
        ]);
        type L = { blockNumber: bigint | null; transactionHash: `0x${string}` | null; args: Record<string, bigint> };
        const raw: { kind: ActivityItem["kind"]; log: L; amount: bigint; extra?: bigint }[] = [
          ...(staked as unknown as L[]).map((l) => ({ kind: "stake" as const, log: l, amount: l.args.amount, extra: l.args.periods })),
          ...(claimed as unknown as L[]).map((l) => ({ kind: "claim" as const, log: l, amount: l.args.amount })),
          ...(withdrawn as unknown as L[]).map((l) => ({ kind: "withdraw" as const, log: l, amount: l.args.amount })),
          ...(expired as unknown as L[]).map((l) => ({ kind: "forfeit" as const, log: l, amount: l.args.amount })),
        ];
        const blocks = Array.from(new Set(raw.map((r) => r.log.blockNumber).filter((b): b is bigint => b !== null))).slice(-60);
        const times = new Map<bigint, number>();
        await Promise.all(
          blocks.map(async (bn) => {
            const b = await client.getBlock({ blockNumber: bn });
            times.set(bn, Number(b.timestamp));
          }),
        );
        const out: ActivityItem[] = raw
          .filter((r) => r.log.blockNumber !== null && r.log.transactionHash)
          .map((r) => ({
            kind: r.kind,
            amount: r.amount,
            extra: r.extra,
            time: times.get(r.log.blockNumber!) ?? 0,
            hash: r.log.transactionHash!,
          }))
          .sort((a, b) => b.time - a.time);
        if (!cancelled) setItems(out.slice(0, 30));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, user, refreshKey]);

  return { items, loading };
}
