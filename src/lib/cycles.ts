/**
 * @file Calendar-month cycle math (UTC) mirroring the contract: epoch ids, cycle boundaries, claim windows and labels.
 */
/**
 * Monthly reward cycles (UTC, matching block timestamps).
 *
 * - A cycle is one calendar month: 1st 00:00 UTC → 1st of next month 00:00 UTC.
 * - A stake made during month M joins the cycle of month M+1.
 * - When a cycle closes, its rewards are claimable for CLAIM_BUFFER_DAYS, then expire.
 */
export const CLAIM_BUFFER_DAYS = 30;
const DAY = 86_400;

export type CycleStatus = "upcoming" | "active" | "claimable" | "expired";

export type Cycle = {
  key: string; // "2026-10"
  label: string; // "Oct 2026"
  start: number; // unix seconds
  end: number; // unix seconds (exclusive)
  claimUntil: number; // unix seconds
};

const monthStart = (y: number, m: number) => Date.UTC(y, m, 1) / 1000;

export function cycleAt(y: number, m: number): Cycle {
  const d = new Date(Date.UTC(y, m, 1));
  const yy = d.getUTCFullYear();
  const mm = d.getUTCMonth();
  const start = monthStart(yy, mm);
  const end = monthStart(yy, mm + 1);
  return {
    key: `${yy}-${String(mm + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
    start,
    end,
    claimUntil: end + CLAIM_BUFFER_DAYS * DAY,
  };
}

export function statusOf(c: Cycle, now: number): CycleStatus {
  if (now < c.start) return "upcoming";
  if (now < c.end) return "active";
  if (now < c.claimUntil) return "claimable";
  return "expired";
}

/** Previous (in claim window), current (earning) and next (open for new stakes) cycles. */
export function cyclesAround(now: number) {
  const d = new Date(now * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return { previous: cycleAt(y, m - 1), current: cycleAt(y, m), next: cycleAt(y, m + 1) };
}

/**
 * History from the pool launch month (NEXT_PUBLIC_POOL_START_MONTH, "YYYY-MM")
 * up to the next cycle, newest first. Defaults to the last 6 months.
 */
export function cycleHistory(now: number): Cycle[] {
  const d = new Date(now * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const env = process.env.NEXT_PUBLIC_POOL_START_MONTH?.match(/^(\d{4})-(\d{2})$/);
  const startIdx = env ? Number(env[1]) * 12 + Number(env[2]) - 1 : y * 12 + m - 6;
  const out: Cycle[] = [];
  for (let i = y * 12 + m + 1; i >= startIdx && out.length < 36; i--) {
    out.push(cycleAt(Math.floor(i / 12), i % 12));
  }
  return out;
}

export const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Last moment inside a cycle, for display ("ends 31 Oct"). */
export const fmtEnd = (s: number) => fmtDate(s - 1);

/** Contract epoch id (year*12 + month0) ↔ Cycle. */
export const epochIdOf = (c: Cycle) => {
  const [y, m] = c.key.split("-").map(Number);
  return y * 12 + (m - 1);
};
export const cycleOfEpoch = (id: number) => cycleAt(Math.floor(id / 12), id % 12);
