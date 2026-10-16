# End-to-end tests (Playwright + anvil)

Python Playwright scripts that drive the real website against a local chain. A fake EIP-1193
provider is injected so no browser wallet is needed; `page.clock` moves the UI through months.

| Script | Scenario |
|---|---|
| `lifecycle.py` | Stake → earn → claim → grace withdraw → principal-only after grace |
| `lifecycle_positions.py` | Multiple positions per wallet, withdraw one / all |
| `admin_and_activity.py` | Admin dashboard figures and the activity list |
| `lock_options_and_admin.py` | Lock options from the contract and admin toggles |

## Run

```bash
anvil --chain-id 15324 --timestamp 1792022400 &        # 2026-10-15 UTC
cd contracts && forge script script/LocalSetup.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 && cd ..
NEXT_PUBLIC_STAKING_POOL_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 \
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 npm run build
PORT=3129 npm start &
python3 e2e/lifecycle.py
```

The private key above is anvil's public test key — never use it on a real network.
