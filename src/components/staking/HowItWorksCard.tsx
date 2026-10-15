export function HowItWorksCard() {
  return (
    <div className="tile dark">
      <span className="lbl">
        <i /> How it works
      </span>
      <ol className="steps">
        <li>
          <span>
            <b>Stake reAED</b>Lock for one or more 30-day periods.
          </span>
        </li>
        <li>
          <span>
            <b>Accumulate weight</b>Weight grows with amount × time staked.
          </span>
        </li>
        <li>
          <span>
            <b>Earn network revenue</b>Rewards come from real fees, not emissions.
          </span>
        </li>
        <li>
          <span>
            <b>Claim each cycle</b>Unclaimed rewards expire after the claim window.
          </span>
        </li>
      </ol>
    </div>
  );
}
