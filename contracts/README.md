# INFRA staking contracts

| Contract | Role |
|---|---|
| `DividendPoolNativeV2` | Collects network fees (reAED); owner forwards them with `sendRewardsToStaking(amount)`. Copy of the existing contract, used for integration tests. |
| `InfraStakingPool` | Monthly staking pool: stakes, weights, 30-day claims, rollover. Receives rewards via `fundRewardsFromDividendPool()`. |

## Rules (InfraStakingPool)
- **Cycles = calendar months (UTC).** Epoch id = `year*12 + month-1`.
- **Stake in month M → earns from month M+1.** One active stake per wallet. Lock = `periods` full months (1–12); after the lock the stake keeps earning until `withdraw()`.
- **Rewards = what arrives during the month** (from the dividend pool or any transfer). No APR.
- **Weight = amount × seconds active in the month.** Share = your weight ÷ month's total weight. Exiting mid-month keeps the weight earned up to exit.
- **Claim within 30 days after the month closes.** After that, anyone can call `rolloverExpired(epoch)` to move unclaimed rewards into the running month. A month with no stakers can be rolled over as soon as it closes.
- **Owner (use a multisig):** UUPS upgrades, `setDividendPool`, `ownerWithdrawRewards` (reward funds only, never principal), `emergencyWithdraw` (any amount, including principal).

## Monthly operation
1. During the month: fees accumulate in the dividend pool.
2. Before month end (e.g. last day 23:00 UTC): dividend-pool owner calls `sendRewardsToStaking(balance)` → credited to the running month.
3. After month end: stakers claim for 30 days.
4. After the window: anyone calls `rolloverExpired(epoch)`.

## Dev
```bash
npm install                      # OpenZeppelin 5.2.0
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```
