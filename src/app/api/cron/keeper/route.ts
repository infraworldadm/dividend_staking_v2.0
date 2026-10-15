import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { appChain } from "@/lib/web3/chains";
import { stakingPoolAbi, stakingPoolAddress } from "@/lib/web3/contract";

/**
 * Daily keeper (Vercel Cron, see vercel.json). Calls poke() on the staking pool when needed:
 * pulls the dividend pool at month start and sweeps expired rewards to the admin wallet.
 *
 * Env: KEEPER_PRIVATE_KEY — a NEW wallet holding only a little reAED for gas. It has NO
 *      special rights (poke() is public and can only move funds to stakers / admin wallet).
 *      CRON_SECRET — Vercel sends it as "Authorization: Bearer …" on cron calls.
 * Optional: users' own transactions also trigger the same automation.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!stakingPoolAddress || !key) {
    return NextResponse.json({ skipped: "KEEPER_PRIVATE_KEY or staking address not set" });
  }
  const rpc = http(appChain.rpcUrls.default.http[0]);
  const pub = createPublicClient({ chain: appChain, transport: rpc });
  const sp = { abi: stakingPoolAbi, address: stakingPoolAddress } as const;

  const due = await pub.readContract({ ...sp, functionName: "needsPoke" });
  if (!due) return NextResponse.json({ ok: true, action: "none" });

  const account = privateKeyToAccount(key.startsWith("0x") ? key : (`0x${key}` as Hex));
  const wallet = createWalletClient({ account, chain: appChain, transport: rpc });
  await pub.simulateContract({ ...sp, functionName: "poke", account });
  const hash = await wallet.writeContract({ ...sp, functionName: "poke" });
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 50_000 }).catch(() => null);
  return NextResponse.json({ ok: true, action: "poke", hash, status: rc?.status ?? "pending" });
}
