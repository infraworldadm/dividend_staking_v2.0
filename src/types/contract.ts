/** InfraStakingPool.positionsOf(address)[i] */
export type StakePosition = {
  amount: bigint;
  id: bigint;
  stakedAt: bigint;
  periods: bigint;
  activeFrom: bigint;
  lockEnd: bigint;
  lastSettledEpoch: bigint;
};

/** InfraStakingPool.accounts(address) */
export type StakeAccount = {
  staked: bigint;
  totalClaimed: bigint;
  totalExpired: bigint;
  nextId: bigint;
};

export type PoolState = {
  totalStaked: bigint;
  currentEpoch: bigint;
  dividendPool?: `0x${string}`;
  totalRewardsClaimed: bigint;
};

export type EpochChain = { reward: bigint; claimed: bigint; swept: boolean; mine: bigint };
