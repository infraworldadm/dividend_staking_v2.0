# dividend_staking

Next.js frontend for INFRA Dividend Pool staking.

## Stack

- Next.js 15 (App Router, TypeScript)
- wagmi + viem
- RainbowKit
- Tailwind CSS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Update values in `.env.local`:

- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_CHAIN_NAME`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_EXPLORER_URL`
- `NEXT_PUBLIC_NATIVE_NAME`
- `NEXT_PUBLIC_NATIVE_SYMBOL`
- `NEXT_PUBLIC_STAKING_POOL_ADDRESS` (InfraStakingPool proxy; dividend pool is read from the contract)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Default `.env.example` is prefilled for INFRA (`chainId: 15324`, native token: `ReAED`).

4. Run dev server:

```bash
npm run dev
```

## Contract actions wired (InfraStakingPool — see `contracts/README.md`)

- `stake(uint256 months)` with native value · `claim()` · `withdraw()`
- Reads: `users`, `pendingRewards`, `currentEpochShare`, `graceEnd`, `totalStaked`, `currentEpoch`, `dividendPool`, `epochInfo`, `userEpochReward`
- Live dividend pool balance shown as this month's upcoming reward pool
- ABI: `src/lib/web3/stakingAbi.ts` (generated from `contracts/out`)
