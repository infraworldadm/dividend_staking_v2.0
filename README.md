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
- `NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS`

Default `.env.example` is prefilled for INFRA (`chainId: 15324`, native token: `ReAED`).

4. Run dev server:

```bash
npm run dev
```

## Contract actions wired

- `stake(uint256 periods)` with native value
- `claim()`
- `withdraw()`
- Reads from `users(address)`, `totalStaked`, `totalLocked`, `rewardVaultBalance`
- 

## Notes

- UI follows the screenshot style while mapping to deployed contract behavior.
- Unstake input is removed from contract logic (withdraw is full principal withdrawal).
- Reward expiry countdown is shown from `rewardExpiryAt`..
