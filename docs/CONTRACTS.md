# Contract reference

Source: `contracts/src/`. Solidity 0.8.26, OpenZeppelin 5.2.0 (upgradeable), optimizer 200 runs.
Addresses: [`deployments/uat.json`](../deployments/uat.json). Narrative design: [ARCHITECTURE.md](ARCHITECTURE.md).

Legend — **Who**: `anyone` · `owner` (multisig before mainnet) · `dividendPool` · `staking`.

---

## InfraStakingPool

### Constants
| Name | Value | Meaning |
|---|---|---|
| `CLAIM_WINDOW` | 30 days | Claim window per month, and grace period after a lock ends |
| `MAX_PERIODS` | 12 | Longest lock in months |
| `MAX_POSITIONS` | 20 | Open positions per wallet |

### Staker actions
| Function | Who | Description |
|---|---|---|
| `stake(uint256 periods) payable → positionId` | anyone | Opens a position of `msg.value`. Joins next month; earns for `periods` months. `periods` must be allowed (`isAllowedPeriod`). |
| `claim()` | anyone | Pays all claimable rewards across the wallet's positions (months still inside their 30-day window). |
| `withdraw(uint256 positionId)` | anyone | After the lock ends: returns principal (+ rewards if inside grace). After grace: principal only. |
| `withdrawAll()` | anyone | `withdraw` for every ended position. |

### Automation / keepers
| Function | Who | Description |
|---|---|---|
| `poke()` | anyone | Runs `_sync()`: month weights, auto-pull from the dividend pool, auto-sweep expired months. |
| `needsPoke() view → bool` | anyone | True when `poke()` would do something. Used by `/api/cron/keeper`. |
| `sweepExpired(uint256 epoch)` | anyone | Manually sweep one closed month after its window (no-op if already swept). Funds only go to `adminWallet`. |
| `releaseStakes(address[] list)` | anyone | Returns principal of positions past lock + grace to each staker's own wallet. |

### Funding
| Function | Who | Description |
|---|---|---|
| `fundRewardsFromDividendPool() payable` | dividendPool / owner | Adds `msg.value` to the **running** month (manual top-up path). |
| `fundEpoch(uint256 epoch) payable` | owner | Adds to the running or a future month. |
| `receive()` | dividendPool / owner | Plain transfers fund the running month; during an auto-pull they are booked to the closed month. |

### Owner / configuration
| Function | Description |
|---|---|
| `setAllowedPeriod(uint256 periods, bool allowed)` | Offer / withdraw a lock length (1–12). Existing positions unaffected. |
| `setAutoPull(bool enabled)` | Toggle automatic monthly pull (default on). |
| `setDividendPool(address)` / `setAdminWallet(address)` | Update linked addresses. |
| `ownerWithdrawRewards(address to, uint256 amount)` | Withdraw reward funds only (never principal). Careful: may include still-claimable rewards. |
| `emergencyWithdraw(address to, uint256 amount)` | Any amount, including principal. Emergencies only. |
| `upgradeToAndCall(address impl, bytes data)` | UUPS upgrade. |
| `initialize(owner, dividendPool, adminWallet)` | New proxy setup (once). |
| `upgradeToMonthlyPool(dividendPool, adminWallet)` | In-place migration from the legacy contract (`reinitializer(3)`, requires no legacy stake). |

### Views
| Function | Returns |
|---|---|
| `positionsOf(user)` | `Position[]` — `{amount, id, stakedAt, periods, activeFrom, lockEnd, lastSettledEpoch}` |
| `positionCount(user)` | Open positions |
| `accounts(user)` | `{staked, totalClaimed, totalExpired, nextId}` |
| `pendingRewards(user)` | `(amount, nextDeadline)` claimable now (includes not-yet-pulled pool) |
| `pendingOfPosition(user, index)` | Same, for one position |
| `currentEpochShare(user)` | `(epoch, weight, totalWeight, rewardSoFar)` for the running month |
| `rewardOf(epoch)` | Month reward including the pending auto-pull amount — use this in UIs |
| `epochReward(epoch)` | Month reward booked in storage |
| `epochInfo(epoch)` | `(start, end, deadline, reward, weight, claimed, swept)` |
| `totalWeight(epoch)` / `userWeight(user, epoch)` / `userEpochReward(user, epoch)` | Weight and reward breakdowns |
| `allowedPeriods()` | Lock options currently offered |
| `currentEpoch()` / `epochOf(ts)` / `epochStart(e)` / `epochEnd(e)` / `claimDeadline(e)` | Calendar helpers (UTC) |
| `totalStaked`, `stakerCount`, `openPositions`, `surplusBalance` | Pool totals |
| `totalRewardsReceived`, `totalRewardsClaimed`, `totalExpiredSwept`, `totalRewardsWithdrawnByOwner` | Lifetime accounting |
| `autoPullEnabled`, `lastPulledEpoch`, `nextSweepEpoch`, `lastSyncedEpoch` | Automation state |

### Events
`Staked`, `Withdrawn`, `Claimed`, `RewardsExpiredForUser`, `RewardsFunded`, `ExpiredRewardsSwept`,
`AutoPulled`, `AutoPullSet`, `DividendPoolUpdated`, `AdminWalletUpdated`, `AllowedPeriodSet`,
`OwnerRewardsWithdrawn`, `EmergencyWithdraw`.

### Storage layout (do not break)
| Slots | Content |
|---|---|
| 0–11 | Legacy `StakingPoolFromDividendPoolV2` layout (kept for the in-place upgrade) |
| 12–28 | Monthly pool state (positions, accounts, epochs, totals, allowed periods, counters) |
| 29–31 | `lastPulledEpoch`, `nextSweepEpoch`, `autoPullEnabled` + `_pulling` (packed) |
| 32–49 | `__gap[18]` |

---

## DividendPoolNativeV2

| Function | Who | Description |
|---|---|---|
| `receive()` | anyone | Accepts fees. |
| `pullForStaking() → amount` | staking | Sends the whole balance to `stakingContract`. Used by auto-pull. |
| `setStakingContract(address)` | owner | Link the staking pool. |
| `sendRewardsToStaking(uint256)` | owner | Manual top-up → running month. |
| `sendRewardsToStakingPlain(uint256)` | owner | Same, plain transfer. |
| `emergencyWithdraw(address, uint256)` | owner | Safety valve. |
| `stakingContract`, `totalReceived`, `totalRewardsSentToStaking` | view | State / accounting. |

---

## Tests (`contracts/test`)

| File | Covers |
|---|---|
| `InfraStakingPool.t.sol` | Calendar math, stake/claim/withdraw, multi-position, lock options, grace, sweep, release, owner limits, counters, auto-pull + auto-sweep with no admin, automation never blocking users, payout-never-exceeds-rewards fuzz |
| `UpgradeFromLegacy.t.sol` | In-place upgrade from the legacy proxy, owner-only/once, refusal while legacy stakes exist, full monthly flow after upgrade |

Run: `cd contracts && forge test` (27 tests).
