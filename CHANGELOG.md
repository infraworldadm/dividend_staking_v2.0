# Changelog

## 2026-10-16
- **UAT go-live:** staking proxy upgraded (impl `0x53Ab…Da64`, tx `0x4721…0c37`); dividend pool upgraded (impl `0x987a…5475`, tx `0x86e6…8868`). Staking open on the website; automatic monthly payouts active.
- Project structure & docs: `deployments/uat.json` registry, `docs/` (architecture, contracts, operations), file headers and comments across the codebase, CI workflow, ESLint config fix.

## 2026-10-15
- **Contracts:** automatic monthly payouts — staking pool auto-pulls the dividend pool at month start and auto-sweeps expired rewards; public `poke()` / `needsPoke()`; dividend pool `pullForStaking()`.
- Lock options 1, 2, 6, 8, 9, 12 months enforced on-chain; multiple positions per wallet (max 20).
- Admin: username/password login, analytics-first dashboard, manual overrides collapsed.
- Daily Vercel Cron keeper (gas-only wallet).
- INFRA Wallet on mobile (in-app browser + WalletConnect), `/wallet-debug`.
- Big live dividend-pool hero; pool balance visible before the contract upgrade.
- SEO: metadata, share image, icons, JSON-LD, robots, sitemap, manifest.
- "Claim every month" guidance for locks of 2+ months.

## Earlier
- Monthly-cycle model, guided tour, light/dark theme, motion, success animations, INFRA branding, UAT RPC/explorer.
