# INFRA staking contracts

| Contract | Role |
|---|---|
| `DividendPoolNativeV2` | Collects network fees (reAED); owner forwards them with `sendRewardsToStaking(amount)`. Copy of the existing contract, used for integration tests. |
| `InfraStakingPool` | Monthly staking pool: stakes, weights, 30-day claims, rollover. Receives rewards via `fundRewardsFromDividendPool()`. |

## Rules (InfraStakingPool)
- **Cycles = calendar months (UTC).** Epoch id = `year*12 + month-1`.
- **Stake in month M → earns from month M+1, for exactly `periods` months (1–12).** One stake per wallet.
- **Lock ends → earning stops.** The staker has a **30-day grace period** to claim and `withdraw()`.
- **After the grace period → principal only.** Unclaimed rewards are forfeited and sent to the **admin wallet** with `sweepExpired(epoch)` — they are *not* forwarded to the next month. Anyone (admin/keeper script) can also `releaseStake(user)` / `releaseStakes([...])` to return the principal to the staker's own wallet.
- **Rewards = what the dividend pool sends during the month** (only the dividend pool or the owner can fund). E.g. the pool holds 1,000 reAED at month end → 1,000 reAED is split by weight. No APR.
- **Weight = amount × seconds active in the month.** Share = your weight ÷ month's total weight. Exiting mid-month keeps the weight earned up to exit.
- **Claim within 30 days after the month closes.** After that, anyone can call `sweepExpired(epoch)`: unclaimed rewards go to the admin wallet. A month with no stakers can be swept as soon as it closes.
- **Owner (use a multisig):** UUPS upgrades, `setDividendPool`, `setAdminWallet`, `ownerWithdrawRewards` (reward funds only, never principal), `emergencyWithdraw` (any amount, including principal).

## Monthly operation
1. During the month: fees accumulate in the dividend pool.
2. Before month end (e.g. last day 23:00 UTC): dividend-pool owner calls `sendRewardsToStaking(balance)` → credited to the running month.
3. After month end: stakers claim for 30 days.
4. After the window: anyone calls `sweepExpired(epoch)` → unclaimed rewards to the admin wallet.
5. Clean-up: call `releaseStakes([...])` for wallets past lock + 30 days (find them from `Staked` events).

## Dev
```bash
npm install                      # OpenZeppelin 5.2.0
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```
