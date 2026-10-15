# INFRA staking contracts

| Contract | Role |
|---|---|
| `DividendPoolNativeV2` | Collects network fees (reAED); owner forwards them with `sendRewardsToStaking(amount)`. Copy of the existing contract, used for integration tests. |
| `InfraStakingPool` | Monthly staking pool: stakes, weights, 30-day claims, rollover. Receives rewards via `fundRewardsFromDividendPool()`. |

## Rules (InfraStakingPool)
- **Cycles = calendar months (UTC).** Epoch id = `year*12 + month-1`.
- **Multiple positions per wallet (up to 20).** Each `stake()` opens a position: stake in month M → earns from month M+1, for exactly `periods` months (1–12). `claim()` collects from all positions; `withdraw(positionId)` / `withdrawAll()` return ended positions.
- **Lock ends → earning stops.** The staker has a **30-day grace period** to claim and `withdraw()`.
- **After the grace period → principal only.** Unclaimed rewards are forfeited and sent to the **admin wallet** with `sweepExpired(epoch)` — they are *not* forwarded to the next month. Anyone (admin/keeper script) can also `releaseStake(user)` / `releaseStakes([...])` to return the principal to the staker's own wallet.
- **Rewards = what the dividend pool sends during the month** (only the dividend pool or the owner can fund). E.g. the pool holds 1,000 reAED at month end → 1,000 reAED is split by weight. No APR.
- **Weight = amount × seconds active in the month.** Share = your weight ÷ month's total weight. Exiting mid-month keeps the weight earned up to exit.
- **Claim within 30 days after the month closes.** After that, anyone can call `sweepExpired(epoch)`: unclaimed rewards go to the admin wallet. A month with no stakers can be swept as soon as it closes.
- **Owner (use a multisig):** UUPS upgrades, `setDividendPool`, `setAdminWallet`, `ownerWithdrawRewards` (reward funds only, never principal), `emergencyWithdraw` (any amount, including principal).

## Going live on UAT — upgrade the existing proxy (recommended)
The current staking proxy `0xeEb712B20b9d4AEF535a781e1222FD1174fFa919` runs the old
`StakingPoolFromDividendPoolV2` (source in `src/legacy/`). `InfraStakingPool` keeps that
contract's storage slots 0–11 and uses its reserved gap for new state, so it can be installed
in place (same address). `upgradeToMonthlyPool` refuses to run while any old stake is live.

```bash
PROXY=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919 \
DIVIDEND_POOL=0xCD938d217a31C85B9041a218A14015E289D61aC0 \
ADMIN_WALLET=<admin wallet> \
forge script script/UpgradeLegacy.s.sol --rpc-url https://uat.infraworld.org/ --broadcast --private-key $OWNER_KEY
```
Then, as dividend-pool owner (if not already): `setStakingContract(0xeEb712B20b9d4AEF535a781e1222FD1174fFa919)`,
and set `NEXT_PUBLIC_STAKING_POOL_ADDRESS` to the same address in Vercel. Tested in `test/UpgradeFromLegacy.t.sol`.

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
