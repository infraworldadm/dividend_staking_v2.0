/**
 * @file INFRA chain definition for viem/wagmi. All values overridable via NEXT_PUBLIC_* env (defaults: UAT, chain 15324).
 */
import { defineChain } from "viem";

const envChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "15324");
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://uat.infraworld.org/";
const envExplorerUrl =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://uat.scan.infraworld.org/";

export const appChain = defineChain({
  id: envChainId,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || "INFRA Chain",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_NATIVE_NAME || "ReAED",
    symbol: process.env.NEXT_PUBLIC_NATIVE_SYMBOL || "ReAED",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [envRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "INFRA Scan",
      url: envExplorerUrl,
    },
  },
});
