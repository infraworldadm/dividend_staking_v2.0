# INFRA Staking — Dividend Pool

Stake **reAED** on the INFRA Network and earn a monthly share of real network fees.
No inflation, no emissions, no promised APR — each month's dividend pool is split among that
month's stakers by weight.

- **Live (UAT):** https://dividend-staking-v2-0.vercel.app
- **Admin analytics:** https://dividend-staking-v2-0.vercel.app/admin (username/password)
- **Network:** INFRA UAT · chain id `15324` · explorer https://uat.scan.infraworld.org
- **Addresses:** [`deployments/uat.json`](deployments/uat.json) — the single source of truth

---

## How it works (one minute)

1. **Fees collect** in the dividend pool (`DividendPoolNativeV2`) during month **M**.
2. **Stake any time** during month M → your position joins **M+1** (the running month is closed).
3. Pick a lock of **1, 2, 6, 8, 9 or 12 months**. A wallet can hold up to 20 positions.
4. When a month closes, its pool is **pulled automatically** into the staking contract and
   split by weight (`amount × month length`).
5. **Claim each month's reward within 30 days** of that month ending — also during long locks.
   Unclaimed rewards go to the admin wallet automatically.
6. When the lock ends, withdraw principal + rewards within 30 days. After that: principal only.

No admin signature is needed for any of this. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository layout

```
.
├── .github/workflows/ci.yml   CI: typecheck, lint, build, forge test
├── contracts/                 Solidity (Foundry) — see contracts/README.md
│   ├── src/InfraStakingPool.sol        Monthly staking pool (UUPS proxy)
│   ├── src/DividendPoolNativeV2.sol    Fee collector (UUPS proxy)
│   ├── src/legacy/                     Previous staking contract (for the in-place upgrade)
│   ├── test/                           27 Foundry tests (unit, fuzz, upgrade)
│   ├── script/                         Deploy / upgrade / local-setup scripts
│   ├── flattened/                      Single-file sources for Remix / explorer verification
│   └── DEPLOY.md                       Step-by-step UAT upgrade guide
├── deployments/uat.json       Network + contract/wallet addresses + deploy history
├── docs/
│   ├── ARCHITECTURE.md        System design, money flow, frontend data flow
│   ├── CONTRACTS.md           Function-by-function contract reference
│   └── OPERATIONS.md          Runbook: env vars, admin, keeper, monitoring, incidents
├── e2e/                       Playwright end-to-end scripts against a local anvil chain
├── public/                    Static assets (logo, wallet icon, PWA icons)
└── src/
    ├── app/                   Next.js App Router: pages, API routes, SEO files
    │   ├── page.tsx                    / — staking app
    │   ├── admin/                      /admin (+ /admin/login) — analytics
    │   ├── api/admin/*                 login / logout / me
    │   ├── api/cron/keeper             daily automation trigger (Vercel Cron)
    │   └── wallet-debug/               wallet-injection diagnostics
    ├── components/
    │   ├── staking/           Staking UI (hero, stake form, positions, cycles, tour …)
    │   ├── admin/             Admin dashboard + login form
    │   ├── motion/            Animations, number tweening, theme toggle
    │   └── providers/         wagmi / React Query / RainbowKit providers
    ├── hooks/                 useStakingPool (reads/writes), useActivity, useCountdown
    ├── lib/
    │   ├── web3/              chain, wagmi, INFRA Wallet connector, ABIs, addresses
    │   ├── cycles.ts          Calendar-month math (mirrors the contract)
    │   ├── adminAuth.ts       Signed-cookie admin sessions (Edge-compatible)
    │   └── format.ts          Number/time formatting
    ├── middleware.ts          Guards /admin
    └── types/                 Shared TS types
```

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in values (see docs/OPERATIONS.md#environment-variables)
npm run dev                     # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Next.js rules) |
| `cd contracts && forge test` | Contract tests (see contracts/README.md for setup) |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · wagmi v2 + viem · RainbowKit ·
Solidity 0.8.26 · OpenZeppelin 5.2 (upgradeable) · Foundry · Playwright (e2e) · Vercel (hosting + cron).

## Status

| Item | State |
|---|---|
| Website | Live on Vercel (shows live dividend-pool balance; staking switches on after upgrade) |
| Staking proxy `0xeEb7…a919` | **Pending upgrade** to `InfraStakingPool` |
| Dividend pool `0xCD93…1aC0` | **Pending upgrade** (adds `pullForStaking`) |
| Audit | Not yet — required before mainnet |

Track changes in [CHANGELOG.md](CHANGELOG.md).
