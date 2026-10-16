# Operations runbook

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_STAKING_POOL_ADDRESS` | public | after upgrade | Staking proxy. **Set only after the upgrade tx confirms** — it switches staking on. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | public | yes | WalletConnect (mobile wallets, QR). Free at cloud.reown.com. |
| `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_EXPLORER_URL` / `NEXT_PUBLIC_CHAIN_ID` / `NEXT_PUBLIC_CHAIN_NAME` | public | no | Default to INFRA UAT. |
| `NEXT_PUBLIC_NATIVE_NAME` / `NEXT_PUBLIC_NATIVE_SYMBOL` | public | no | Default `ReAED`. |
| `NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS` | public | no | Override the registry's dividend pool (local testing). |
| `NEXT_PUBLIC_INFRA_WALLET_SCHEME` | public | no | INFRA Wallet app deep-link prefix, e.g. `infrawallet://wc?uri=`. |
| `NEXT_PUBLIC_SITE_URL` | public | no | Canonical URL for SEO/share images (set when using a custom domain). |
| `NEXT_PUBLIC_POOL_START_MONTH` | public | no | First month shown in cycle history (`YYYY-MM`). |
| `ADMIN_USERS` | server | for /admin | `user:pass,user2:pass2`. Remove a pair → that operator is logged out immediately. |
| `ADMIN_SESSION_SECRET` | server | for /admin | ≥ 32 random chars; signs session cookies. Rotating it logs everyone out. |
| `CRON_SECRET` | server | for keeper | Vercel sends it to `/api/cron/keeper` as a Bearer token. |
| `KEEPER_PRIVATE_KEY` | server | for keeper | **New gas-only wallet.** No rights. Never the owner key. |

Redeploy after changing any variable.

## Admin console

- URL: `/admin` → redirects to `/admin/login`. Sessions last 12 h.
- Read-only analytics: stakers, positions, totals, pool so far, owed (claimable) rewards, lock
  breakdown, 13-month unlock schedule, monthly payouts, automation status, lifetime totals.
- "Manual overrides" (collapsed) need a connected wallet; owner-only actions need the owner.

## Monthly cycle — what happens automatically

| When (UTC) | What | Who triggers |
|---|---|---|
| During month M | Fees accumulate in the dividend pool | network |
| 1st of M+1, first tx or 00:05 keeper | Pool pulled → month M reward; stakers of M can claim | any tx / keeper |
| 30 days after M ends | Unclaimed M rewards → admin wallet | any tx / keeper |

Nothing to sign. Check `/admin → Automation` shows **Up to date**.

## Keeper

- Schedule: `vercel.json` → `5 0 * * *` (daily 00:05 UTC).
- Manual test: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/keeper`
  → `{"action":"none"}` or `{"action":"poke","hash":"0x…"}`.
- Keep ~1 reAED in the keeper wallet for gas; check it monthly.
- If the keeper is down, any user transaction runs the same automation; anyone can also call `poke()`.

## Deploy / upgrade contracts

Follow [contracts/DEPLOY.md](../contracts/DEPLOY.md). Afterwards:
1. Record tx hashes and new implementation addresses in `deployments/uat.json` (`history`).
2. Set `NEXT_PUBLIC_STAKING_POOL_ADDRESS` in Vercel and redeploy.
3. Regenerate ABIs if the contract changed: `cd contracts && forge build`, then update
   `src/lib/web3/stakingAbi.ts` from `contracts/out/InfraStakingPool.sol/InfraStakingPool.json`.

## Incident playbook

| Symptom | Check | Fix |
|---|---|---|
| Users see 0 claimable after month start | `/admin` automation, `needsPoke()` | Call keeper URL or `poke()` from any wallet |
| Expired rewards not reaching admin wallet | Admin wallet is a contract that rejects transfers? | `setAdminWallet` to an EOA/Safe that accepts native coin, then `poke()` |
| Auto-pull failing (`AutoPulled ok=false` events) | Dividend pool upgraded? `stakingContract()` = staking proxy? | Upgrade dividend pool / `setStakingContract` |
| Wallet won't connect on mobile | `/wallet-debug` inside the wallet app | See README → wallets; set WalletConnect project id |
| Admin login says "not configured" | `ADMIN_USERS`, `ADMIN_SESSION_SECRET` (≥32 chars) | Set and redeploy |

## Before mainnet

- Transfer ownership of both proxies to a Gnosis Safe.
- Independent security audit.
- Re-run the full test suite and e2e scripts; verify storage layout with `forge inspect … storageLayout`.
