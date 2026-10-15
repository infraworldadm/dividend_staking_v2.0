export type UserInfo = {
  amount: bigint;
  startDate: bigint;
  countOfPeriods: bigint;
  endDate: bigint;
  weight: bigint;
  lastUpdate: bigint;
  rewardDebt: bigint;
  pendingClaimable: bigint;
  totalClaimed: bigint;
  rewardExpiryAt: bigint;
  expiredRewardsTotal: bigint;
};

export type PoolInfo = {
  totalStaked: bigint;
  totalLocked: bigint;
  totalWeight: bigint;
  lastGlobalUpdate: bigint;
  rewardVaultBalance: bigint;
  rewardExpiryWindow: bigint;
};
