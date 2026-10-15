export function HowItWorksCard() {
  return (
    <div className="tile dark">
      <span className="lbl">
        <i /> How it works
      </span>
      <ol className="steps">
        <li>
          <span>
            <b>Stake reAED</b>Your stake joins next month&apos;s cycle.
          </span>
        </li>
        <li>
          <span>
            <b>Earn through the month</b>Weight grows with amount × time staked.
          </span>
        </li>
        <li>
          <span>
            <b>Cycle closes at month end</b>Rewards come from real network fees.
          </span>
        </li>
        <li>
          <span>
            <b>Claim within 30 days</b>Unclaimed rewards expire after the window.
          </span>
        </li>
      </ol>
    </div>
  );
}
