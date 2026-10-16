/**
 * @file Formatting helpers for token amounts, percentages and countdowns.
 */
import { formatEther } from "viem";

export function formatToken(value: bigint | undefined, digits = 2) {
  if (value === undefined) return "0.00";
  const raw = Number(formatEther(value));
  if (!Number.isFinite(raw)) return "0.00";
  return raw.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return "00:00:00";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  if (days > 0) return `${days}d ${hours}:${mins}:${secs}`;
  return `${hours}:${mins}:${secs}`;
}
