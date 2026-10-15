"use client";

type StakePanelProps = {
  mode: "stake" | "withdraw";
  setMode: (mode: "stake" | "withdraw") => void;
  amount: string;
  setAmount: (value: string) => void;
  periods: number;
  setPeriods: (value: number) => void;
  walletBalance: string;
  walletBalanceRaw: string;
  stakedAmount: string;
  weightMetricLabel: string;
  weightMetricValue: string;
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  onStake: () => void;
  onWithdraw: () => void;
  isStakeDisabled: boolean;
  stakeDisabledReason: string | null;
  isWithdrawDisabled: boolean;
  withdrawDisabledReason: string | null;
  busy: boolean;
  symbol: string;
};

export function StakePanel({
  mode,
  setMode,
  amount,
  setAmount,
  periods,
  setPeriods,
  walletBalance,
  walletBalanceRaw,
  stakedAmount,
  weightMetricLabel,
  weightMetricValue,
  termsAccepted,
  setTermsAccepted,
  onStake,
  onWithdraw,
  isStakeDisabled,
  stakeDisabledReason,
  isWithdrawDisabled,
  withdrawDisabledReason,
  busy,
  symbol,
}: StakePanelProps) {
  const inStakeMode = mode === "stake";

  return (
    <div className="rounded-xl2 border border-borderSoft bg-cardBg p-0 shadow-card">
      <div className="grid grid-cols-2 gap-3 p-2">
        <button
          onClick={() => setMode("stake")}
          className={`rounded-md py-2 text-sm font-medium ${
            inStakeMode ? "bg-[#d8e8ff] text-slate-900" : "bg-[#f5f7fb] text-slate-500"
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`rounded-md py-2 text-sm font-medium ${
            !inStakeMode ? "bg-[#d8e8ff] text-slate-900" : "bg-[#f5f7fb] text-slate-500"
          }`}
        >
          Unstake
        </button>
      </div>

      <div className="border-t border-borderSoft p-4">
        {inStakeMode ? (
          <>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Stake {symbol}</span>
              <span>INFRA Real Yield (IRY)</span>
            </div>
            <div className="flex items-center rounded-lg border border-borderSoft bg-[#f8fafc] px-3 py-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border-0 bg-transparent text-2xl font-semibold outline-none"
              />
              <button
                onClick={() => setAmount(walletBalanceRaw)}
                className="rounded bg-[#e7f0ff] px-3 py-1 text-xs font-semibold text-brand"
              >
                Max
              </button>
            </div>
            <div className="mt-2 text-xs text-textMuted">Balance: {walletBalance} {symbol}</div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Lock Periods (30 days each)</span>
              <select
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
                className="rounded border border-borderSoft bg-white px-2 py-1 text-sm"
              >
                {[1, 2, 3, 6, 12].map((p) => (
                  <option key={p} value={p}>
                    {p} period{p > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Withdraw Staked Amount</span>
              <span>INFRA Real Yield (IRY)</span>
            </div>
            <div className="rounded-lg border border-borderSoft bg-[#f8fafc] px-3 py-3 text-2xl font-semibold">
              {stakedAmount}
            </div>
            <div className="mt-2 text-xs text-textMuted">Staked: {stakedAmount} {symbol}</div>
          </>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-borderSoft pt-3 text-sm text-slate-500">
          <span>{weightMetricLabel}</span>
          <span className={inStakeMode ? "text-slate-500" : "text-red-500"}>{weightMetricValue}</span>
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-textMuted">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-[2px]"
          />
          <span>
            Accept Terms and Services
            <br />
            By staking, you agree to our platform's terms and distribution policies.
          </span>
        </label>

        <button
          onClick={inStakeMode ? onStake : onWithdraw}
          disabled={inStakeMode ? isStakeDisabled || busy : isWithdrawDisabled || busy}
          title={inStakeMode ? stakeDisabledReason || "" : withdrawDisabledReason || ""}
          className="mt-4 w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Processing..."
            : inStakeMode
              ? `Stake ${symbol}`
              : "Withdraw & Claim Rewards"}
        </button>

        {(inStakeMode ? stakeDisabledReason : withdrawDisabledReason) ? (
          <p className="mt-2 text-xs text-textMuted">
            {inStakeMode ? stakeDisabledReason : withdrawDisabledReason}
          </p>
        ) : null}
      </div>

      <div className="m-3 rounded-lg border border-[#f5d6a5] bg-[#fff8ec] p-3 text-xs text-[#b16b17]">
        Rewards are proportional to your staked amount and time. Earlier stakers receive more rewards in the same period.
      </div>
    </div>
  );
}
