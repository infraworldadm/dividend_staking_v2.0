"use client";

import { useMemo } from "react";
import { parseEther } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { dividendPoolAbi, dividendPoolAddress } from "@/lib/web3/contract";

function extractErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (
    typeof err === "object" &&
    "shortMessage" in err &&
    typeof err.shortMessage === "string"
  ) {
    return err.shortMessage;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function useDividendPoolWrites() {
  const {
    writeContract,
    data: txHash,
    error,
    isPending: isSigning,
    reset,
  } = useWriteContract();

  const tx = useWaitForTransactionReceipt({ hash: txHash });
  const hasActiveTx = Boolean(txHash);

  const errorMessage = useMemo(() => {
    return extractErrorMessage(error);
  }, [error]);

  const stake = (amount: string, periods: number) => {
    writeContract({
      abi: dividendPoolAbi,
      address: dividendPoolAddress,
      functionName: "stake",
      args: [BigInt(periods)],
      value: parseEther(amount || "0"),
    });
  };

  const claim = () => {
    writeContract({
      abi: dividendPoolAbi,
      address: dividendPoolAddress,
      functionName: "claim",
      args: [],
    });
  };

  const withdraw = () => {
    writeContract({
      abi: dividendPoolAbi,
      address: dividendPoolAddress,
      functionName: "withdraw",
      args: [],
    });
  };

  return {
    stake,
    claim,
    withdraw,
    txHash,
    hasActiveTx,
    isSigning,
    isConfirming: hasActiveTx && tx.isPending,
    isConfirmed: tx.isSuccess,
    errorMessage,
    reset,
  };
}
