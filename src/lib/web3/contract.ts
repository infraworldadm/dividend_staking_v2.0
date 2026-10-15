import type { Abi } from "viem";

export const dividendPoolAddress =
  (process.env.NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS as `0x${string}` | undefined) ||
  "0x51E92D567bCe692B27039Dde220FC68B5c731beE";

export const dividendPoolAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "payable",
    inputs: [{ name: "periods", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "users",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "startDate", type: "uint256" },
      { name: "countOfPeriods", type: "uint256" },
      { name: "endDate", type: "uint256" },
      { name: "weight", type: "uint256" },
      { name: "lastUpdate", type: "uint256" },
      { name: "rewardDebt", type: "uint256" },
      { name: "pendingClaimable", type: "uint256" },
      { name: "totalClaimed", type: "uint256" },
      { name: "rewardExpiryAt", type: "uint256" },
      { name: "expiredRewardsTotal", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLocked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalWeight",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lastGlobalUpdate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardVaultBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "REWARD_EXPIRY_WINDOW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;
