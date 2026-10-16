# Flattened sources

Single-file versions of the contracts for Remix / explorer verification
(compiler 0.8.26, optimizer on, 200 runs). Regenerate after any change:

```bash
forge flatten src/InfraStakingPool.sol -o flattened/InfraStakingPool.flat.sol
forge flatten src/DividendPoolNativeV2.sol -o flattened/DividendPoolNativeV2.flat.sol
```

Do not edit these files by hand.
