"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { dividendPoolAbi, dividendPoolAddress } from "@/lib/web3/contract";
import type { PoolInfo, UserInfo } from "@/types/contract";

function asBigInt(value: unknown): bigint {
  return typeof value === "bigint" ? value : 0n;
}

function parseUserInfo(raw: unknown): UserInfo {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    amount: asBigInt(arr[0]),
    startDate: asBigInt(arr[1]),
    countOfPeriods: asBigInt(arr[2]),
    endDate: asBigInt(arr[3]),
    weight: asBigInt(arr[4]),
    lastUpdate: asBigInt(arr[5]),
    rewardDebt: asBigInt(arr[6]),
    pendingClaimable: asBigInt(arr[7]),
    totalClaimed: asBigInt(arr[8]),
    rewardExpiryAt: asBigInt(arr[9]),
    expiredRewardsTotal: asBigInt(arr[10]),
  };
}

export function useDividendPoolReads() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "totalStaked",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "totalLocked",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "totalWeight",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "lastGlobalUpdate",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "rewardVaultBalance",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "REWARD_EXPIRY_WINDOW",
      },
      {
        abi: dividendPoolAbi,
        address: dividendPoolAddress,
        functionName: "users",
        args: [address || "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: {
      enabled: Boolean(dividendPoolAddress),
      refetchInterval: 10000,
    },
  });

  const poolInfo = useMemo<PoolInfo>(() => {
    return {
      totalStaked: asBigInt(data?.[0]?.result),
      totalLocked: asBigInt(data?.[1]?.result),
      totalWeight: asBigInt(data?.[2]?.result),
      lastGlobalUpdate: asBigInt(data?.[3]?.result),
      rewardVaultBalance: asBigInt(data?.[4]?.result),
      rewardExpiryWindow: asBigInt(data?.[5]?.result),
    };
  }, [data]);

  const userInfo = useMemo<UserInfo>(() => parseUserInfo(data?.[6]?.result), [data]);

  return {
    isConnected,
    address,
    isLoading,
    poolInfo,
    userInfo,
    refetch,
  };
}
