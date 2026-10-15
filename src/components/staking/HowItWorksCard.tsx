export function HowItWorksCard() {
  return (
    <div className="tile dark">
      <span className="lbl">
        <i /> How it works
      </span>
      <ol className="steps">
        <li>
          <span>
            <b>Stake reAED for 1–12 months</b>Your stake joins next month&apos;s cycle.
          </span>
        </li>
        <li>
          <span>
            <b>Earn each locked month</b>Your share = your stake ÷ everyone’s stake that month.
          </span>
        </li>
        <li>
          <span>
            <b>Dividend pool pays at month end</b>Network fees collected that month are split by share.
          </span>
        </li>
        <li>
          <span>
            <b>Claim every month, within 30 days</b>Each month’s reward has its own 30-day window — also on 6 and 12-month locks.
          </span>
        </li>
      </ol>
    </div>
  );
}
