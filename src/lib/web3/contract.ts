/**
 * Staking contract (InfraStakingPool proxy). Set NEXT_PUBLIC_STAKING_POOL_ADDRESS
 * after deployment. The dividend pool address is read from the contract itself.
 */
export const stakingPoolAddress = (process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS || undefined) as
  | `0x${string}`
  | undefined;

export const isStakingConfigured = Boolean(stakingPoolAddress && /^0x[0-9a-fA-F]{40}$/.test(stakingPoolAddress));

export { stakingPoolAbi } from "@/lib/web3/stakingAbi";

/** Dividend pool (collects network fees). Read from the staking contract when deployed;
 *  this fallback lets the site show the live pool balance before that. */
export const dividendPoolFallback = (process.env.NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS ||
  "0xCD938d217a31C85B9041a218A14015E289D61aC0") as `0x${string}`;
