# INFRA Staking — UAT deployment (developer handoff)

Upgrade the **existing** staking proxy in place to `InfraStakingPool` (monthly cycles, 30-day grace,
expired rewards → admin wallet). **No new proxy, the address stays the same.**

| Item | Value |
|---|---|
| Network | INFRA UAT · chain id `15324` · RPC `https://uat.infraworld.org/` · explorer `https://uat.scan.infraworld.org/` |
| Staking proxy (keep) | `0xeEb712B20b9d4AEF535a781e1222FD1174fFa919` (currently `StakingPoolFromDividendPoolV2`) |
| Dividend pool | `0xCD938d217a31C85B9041a218A14015E289D61aC0` (`DividendPoolNativeV2`) |
| Admin wallet (expired rewards) | `0xCFc93FB43F17F99EaCa411be595B727501987E95` |
| Owner / signer | Must be the **owner of the staking proxy** (expected `0xCFc9…7E95`) |
| New code | `src/InfraStakingPool.sol` · Solidity `0.8.26` · OpenZeppelin `5.2.0` (contracts + contracts-upgradeable) · optimizer on, 200 runs |

Safety built in: the upgrade call reverts with `Legacy stakes exist` if the old contract still holds
any stake, can only be run by the owner, and only once (`reinitializer(3)`). Storage slots 0–11 match
the old contract exactly (verified with `forge inspect … storageLayout`).

---

## Option A — Foundry (recommended, one command)

```bash
# one-time setup
curl -L https://foundry.paradigm.xyz | bash && foundryup
git clone https://github.com/infraworldadm/dividend_staking_v2.0
cd dividend_staking_v2.0/contracts
npm install
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test            # expect: 22 passed (18 pool + 4 upgrade)

# 1) dry run (no --broadcast) — prints proxy owner and legacy totalStaked (must be 0)
export OWNER_KEY=<owner private key>       # never commit or share
PROXY=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919 \
DIVIDEND_POOL=0xCD938d217a31C85B9041a218A14015E289D61aC0 \
ADMIN_WALLET=0xCFc93FB43F17F99EaCa411be595B727501987E95 \
forge script script/UpgradeLegacy.s.sol --rpc-url https://uat.infraworld.org/ --private-key $OWNER_KEY

# 2) real run — same command + --broadcast
PROXY=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919 \
DIVIDEND_POOL=0xCD938d217a31C85B9041a218A14015E289D61aC0 \
ADMIN_WALLET=0xCFc93FB43F17F99EaCa411be595B727501987E95 \
forge script script/UpgradeLegacy.s.sol --rpc-url https://uat.infraworld.org/ --private-key $OWNER_KEY --broadcast

# 3) link the dividend pool (skip if stakingContract() already returns the proxy)
cast call 0xCD938d217a31C85B9041a218A14015E289D61aC0 "stakingContract()(address)" --rpc-url https://uat.infraworld.org/
cast send 0xCD938d217a31C85B9041a218A14015E289D61aC0 "setStakingContract(address)" \
  0xeEb712B20b9d4AEF535a781e1222FD1174fFa919 --rpc-url https://uat.infraworld.org/ --private-key $OWNER_KEY
```

If the RPC rejects EIP-1559 transactions, add `--legacy` to the `forge script` / `cast send` commands.

## Option B — Remix + wallet (no CLI)

1. Open remix.ethereum.org, create `InfraStakingPool.sol`, paste `src/InfraStakingPool.sol`.
   Remix resolves the `@openzeppelin/...` imports from npm — set the version to **5.2.0**
   (e.g. change imports to `@openzeppelin/contracts-upgradeable@5.2.0/...`).
2. Compiler: `0.8.26`, optimization **on**, 200 runs. Compile.
3. Deploy & Run → Environment **Injected Provider** (INFRA Wallet / MetaMask on chain 15324,
   connected as the **owner** account). Deploy `InfraStakingPool` (no constructor args).
   Note the new **implementation** address.
4. In Remix "At Address", load `0xeEb712B20b9d4AEF535a781e1222FD1174fFa919` with the
   **InfraStakingPool** ABI and call `upgradeToAndCall`:
   - `newImplementation` = implementation address from step 3
   - `data` =
     ```
     0xb08e0409000000000000000000000000cd938d217a31c85b9041a218a14015e289d61ac0000000000000000000000000cfc93fb43f17f99eaca411be595b727501987e95
     ```
     (= `upgradeToMonthlyPool(0xCD938d217a31C85B9041a218A14015E289D61aC0, 0xCFc93FB43F17F99EaCa411be595B727501987E95)`)
5. On the dividend pool `0xCD938d217a31C85B9041a218A14015E289D61aC0` call
   `setStakingContract(0xeEb712B20b9d4AEF535a781e1222FD1174fFa919)` if not already set.

---

## Verify after the upgrade

```bash
R=https://uat.infraworld.org/; P=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919
cast call $P "dividendPool()(address)" --rpc-url $R     # 0xCD938d217a31C85B9041a218A14015E289D61aC0
cast call $P "adminWallet()(address)"  --rpc-url $R     # 0xCFc93FB43F17F99EaCa411be595B727501987E95
cast call $P "currentEpoch()(uint256)" --rpc-url $R     # 24321 = Oct 2026 (year*12 + month-1)
cast call $P "lastSyncedEpoch()(uint256)" --rpc-url $R  # same as currentEpoch
cast call $P "CLAIM_WINDOW()(uint256)" --rpc-url $R     # 2592000 (30 days)
```

## Website

Vercel → project `dividend-staking-v2-0` → Settings → Environment Variables:
`NEXT_PUBLIC_STAKING_POOL_ADDRESS=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919` → Redeploy.
(Set this only **after** the upgrade — the site calls the new contract's functions.)
Also set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (cloud.reown.com) for mobile/QR wallets.

## Monthly admin routine

1. Last day of the month, before 23:59 UTC: on the dividend pool call
   `sendRewardsToStaking(<amount>)` → credited to the running month.
2. After a month's 30-day claim window: on the staking proxy call `sweepExpired(<epochId>)`
   → unclaimed rewards go to the admin wallet. (epochId = year*12 + month-1, e.g. Nov 2026 = 24322)
3. Optional clean-up: `releaseStakes([...])` returns principal of stakes past lock + 30 days.

## Before mainnet

- Move ownership of both contracts to a Gnosis Safe (`transferOwnership(<safe>)`).
- Independent security audit of `InfraStakingPool.sol`.
