/** InfraStakingPool.users(address) */
export type StakeUser = {
  amount: bigint;
  stakedAt: bigint;
  periods: bigint;
  activeFrom: bigint;
  lockEnd: bigint;
  lastSettledEpoch: bigint;
  totalClaimed: bigint;
  totalExpired: bigint;
};

export type PoolState = {
  totalStaked: bigint;
  currentEpoch: bigint;
  dividendPool?: `0x${string}`;
  totalRewardsClaimed: bigint;
};

export type EpochChain = { reward: bigint; claimed: bigint; swept: boolean; mine: bigint };
