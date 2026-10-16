# INFRA staking contracts (Foundry)

| Contract | Role |
|---|---|
| `src/InfraStakingPool.sol` | Monthly staking pool — positions, weights, monthly claims, grace periods, **auto-pull** from the dividend pool and **auto-sweep** of expired rewards. UUPS proxy. |
| `src/DividendPoolNativeV2.sol` | Collects network fees; `pullForStaking()` pays the staking pool once a month. UUPS proxy. |
| `src/legacy/StakingPoolFromDividendPoolV2.sol` | Previous staking implementation (reference for the in-place upgrade). |

- Rules and design: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- Function reference: [../docs/CONTRACTS.md](../docs/CONTRACTS.md)
- Deploy / upgrade on UAT: [DEPLOY.md](DEPLOY.md)
- Addresses: [../deployments/uat.json](../deployments/uat.json)

## Setup & test

```bash
cd contracts
npm install                                                      # OpenZeppelin 5.2.0
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge build
forge test                                                       # 27 tests
```

## Scripts

| Script | Use |
|---|---|
| `script/Deploy.s.sol` | Fresh proxy (`OWNER`, `DIVIDEND_POOL`, `ADMIN_WALLET` env) |
| `script/UpgradeLegacy.s.sol` | In-place upgrade of the existing proxy (`PROXY`, `DIVIDEND_POOL`, `ADMIN_WALLET` env) |
| `script/LocalSetup.s.sol` | Local anvil: deploys and links both contracts (used by `e2e/`) |

## Conventions

- NatSpec on every external function; storage is **append-only** (see slot map in docs/CONTRACTS.md).
- Any contract change → update tests, `docs/CONTRACTS.md`, regenerate the frontend ABI, add a CHANGELOG entry.
