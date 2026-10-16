/**
 * @file Typed access to the deployment registry (`deployments/uat.json`).
 *
 * Keep every on-chain address in that JSON file — not scattered through the code —
 * so developers can audit what the site talks to in one place. Environment variables
 * still win at runtime (useful for local anvil runs and future networks).
 */
import uat from "../../../deployments/uat.json";

type Address = `0x${string}`;

/** Registry for the network this build targets (UAT today). */
export const deployment = uat;

/** InfraStakingPool proxy (stable address; implementation changes on upgrade). */
export const STAKING_POOL_PROXY = uat.contracts.stakingPool.proxy as Address;

/** DividendPoolNativeV2 proxy — collects network fees during the month. */
export const DIVIDEND_POOL_PROXY = uat.contracts.dividendPool.proxy as Address;

/** Wallet that receives expired rewards. */
export const ADMIN_WALLET = uat.wallets.adminWallet.address as Address;
