# Architecture

## 1. Components

| Layer | Piece | Responsibility |
|---|---|---|
| Chain | `DividendPoolNativeV2` (proxy `0xCD93…1aC0`) | Receives network fees in native reAED. Pays the staking pool once a month (`pullForStaking`). |
| Chain | `InfraStakingPool` (proxy `0xeEb7…a919`) | Positions, monthly weights, reward split, claims, grace periods, auto-pull, auto-sweep. |
| Web | Next.js app on Vercel | Staking UI, admin analytics, SEO. Talks to the chain directly from the browser (wagmi/viem). |
| Web | `/api/cron/keeper` + Vercel Cron | Daily `poke()` so month-end automation runs even with no user traffic. |
| Web | `/admin` + `/api/admin/*` | Password-protected analytics (server-side signed cookie). |

## 2. Money flow

```
network fees ──► DividendPoolNativeV2 ──(month M collects)──┐
                                                            │ first tx after M ends
                                                            ▼ (any user action or keeper poke)
                                     InfraStakingPool: epochReward[M] += pool balance
                                                            │
                         stakers of M claim (30 days) ◄─────┤
                                                            │ after 30 days
                                     unclaimed ──► admin wallet (auto-sweep)
```

Owner top-ups (`sendRewardsToStaking`, `fundEpoch`) are optional and add to the running month.

## 3. Time model

- **Epoch = calendar month (UTC).** `epochId = year × 12 + (month − 1)` (Oct 2026 = 24321).
- A position staked in month M is active for months `M+1 … M+periods`.
- **Weight** of a position in a month = `amount × month length (seconds)`; it earns whole months only.
- **Reward** of a position for month E = `epochReward[E] × weight ÷ totalWeight(E)`.
- **Claim window:** month E's reward is claimable until `epochEnd(E) + 30 days`.
- **Grace:** after the lock ends, 30 days to withdraw with rewards; afterwards principal only.

The frontend mirrors this math in `src/lib/cycles.ts` — keep both in sync.

## 4. Automation (no manual monthly step)

`_sync()` runs at the start of every state-changing call (`stake`, `claim`, `withdraw*`,
`releaseStakes`, `sweepExpired`, `poke`):

1. **Weights** — writes the base weight of every month reached since the last sync.
2. **Auto-pull** — once per new month, calls `dividendPool.pullForStaking()` and books the received
   amount as the reward of the month that just closed. Never reverts (failure → retried next call).
3. **Auto-sweep** — sweeps up to 2 expired months per call to the admin wallet. If the admin wallet
   refuses the transfer, it retries later and **never blocks users**.

Views (`pendingRewards`, `rewardOf`, `epochInfo`, `currentEpochShare`) already include the
not-yet-pulled dividend-pool balance, so users see claimable rewards immediately at month start.

The daily keeper (`/api/cron/keeper`, 00:05 UTC) calls `poke()` only when `needsPoke()` is true.
Its wallet holds gas only and has **no privileges**.

## 5. Upgradeability & storage

Both contracts are UUPS proxies (owner-authorised upgrades). `InfraStakingPool` is installed **in
place** on the legacy proxy: slots 0–11 keep the legacy layout, new state uses slots 12–31, and
`__gap[18]` reserves 32–49. **Storage is append-only** — never reorder or remove variables.
`upgradeToMonthlyPool` is `reinitializer(3)` and refuses to run while legacy stakes exist.

## 6. Frontend data flow

```
wagmi/viem (browser) ──multicall every 10 s──► InfraStakingPool views
        │                                     + dividend pool native balance
        ▼
useStakingPool() ──► StakingPage ──► PoolHero · StatsCards · GuideBanner · Tabs
                                     (StakePanel / PositionsPanel / RewardsPanel)
                                     · CycleTimeline · ActivityList · Tour
useStakingWrites() ──► stake / claim / withdraw / withdrawAll ──► SuccessOverlay
```

- `src/lib/web3/addresses.ts` reads `deployments/uat.json`.
- `NEXT_PUBLIC_STAKING_POOL_ADDRESS` deliberately gates staking until the upgrade is confirmed.
- Wallets: INFRA Wallet first (`src/lib/web3/infraWallet.ts`): injected provider (extension or
  in-app browser) chosen at click time, else WalletConnect deep link / QR.

## 7. Admin & security

- `/admin` is guarded by `src/middleware.ts`; sessions are `user|expiry|HMAC-SHA256` cookies
  (httpOnly, secure, SameSite=strict, 12 h). Operators live in `ADMIN_USERS` (server env only).
- The admin page is **read-only analytics**; on-chain overrides are collapsed and require a wallet
  signature (owner for owner-only functions).
- Never store the owner private key on the server. The owner should be a multisig before mainnet.
