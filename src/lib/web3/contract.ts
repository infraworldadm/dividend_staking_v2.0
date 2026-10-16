/**
 * @file Contract wiring for the website.
 *
 * - `stakingPoolAddress` = NEXT_PUBLIC_STAKING_POOL_ADDRESS if set, otherwise the registry's proxy
 *   when `deployments/uat.json` marks it `"status": "live"` (i.e. the upgrade is confirmed). The UI
 *   calls functions that only exist after the upgrade, so it stays "coming soon" until then.
 * - The dividend pool address is read from the staking contract when live; before that we fall
 *   back to the registry (`deployments/uat.json`) so the live pool balance can still be shown.
 */
import { DIVIDEND_POOL_PROXY, STAKING_POOL_PROXY, deployment } from "@/lib/web3/addresses";

/** InfraStakingPool proxy address, or undefined while the upgrade is pending. */
export const stakingPoolAddress = (process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS ||
  (deployment.contracts.stakingPool.status === "live" ? STAKING_POOL_PROXY : undefined)) as `0x${string}` | undefined;

/** True when a valid staking address is configured (enables all staking reads/writes). */
export const isStakingConfigured = Boolean(stakingPoolAddress && /^0x[0-9a-fA-F]{40}$/.test(stakingPoolAddress));

/** Dividend pool used before the staking contract is live (env override for local testing). */
export const dividendPoolFallback = (process.env.NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS ||
  DIVIDEND_POOL_PROXY) as `0x${string}`;

export { stakingPoolAbi } from "@/lib/web3/stakingAbi";
