"use client";

/**
 * @file Animated success overlay shown after stake / claim / withdraw transactions confirm.
 */
import { useEffect } from "react";

export type SuccessKind = "stake" | "withdraw" | "claim";

export type SuccessState = {
  kind: SuccessKind;
  amount: string;
  symbol: string;
  hash?: string;
};

const COPY: Record<SuccessKind, { title: string; body: string }> = {
  stake: { title: "Stake confirmed", body: "Your reAED is locked and now earning weight." },
  withdraw: { title: "Unstaked", body: "Your principal and rewards are back in your wallet." },
  claim: { title: "Rewards claimed", body: "Rewards have been sent to your wallet." },
};

/** Full-screen confirmation shown once a stake / unstake / claim tx is mined. */
export function SuccessOverlay({
  state,
  explorer,
  onClose,
}: {
  state: SuccessState | null;
  explorer?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(onClose, 6000);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, [state, onClose]);

  if (!state) return null;
  const { title, body } = COPY[state.kind];
  const sign = state.kind === "stake" ? "" : "+";

  return (
    <div className={`succ succ-${state.kind}`} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="succ-card" onClick={(e) => e.stopPropagation()}>
        <div className="succ-burst" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} style={{ ["--a" as string]: `${i * 30}deg` }} />
          ))}
        </div>
        <svg className="succ-ic" viewBox="0 0 64 64" aria-hidden>
          <circle className="succ-ring" cx="32" cy="32" r="29" />
          {state.kind === "withdraw" ? (
            <path className="succ-mark" d="M32 42V22M23 31l9-9 9 9" />
          ) : (
            <path className="succ-mark" d="M20 33l8 8 16-17" />
          )}
        </svg>
        <span className="lbl b justify-center">
          <i /> {title}
        </span>
        <div className="succ-amt">
          {sign}
          {state.amount}
          <span className="mono">{state.symbol}</span>
        </div>
        <p className="text-[0.85rem] text-[var(--t2)]">{body}</p>
        <div className="mt-1 grid w-full gap-2">
          {state.hash && explorer ? (
            <a
              className="btn btn-k w-full"
              href={`${explorer}/tx/${state.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer
            </a>
          ) : null}
          <button className="btn w-full !bg-[var(--field)] !text-[var(--t1)]" onClick={onClose}>
            Done
          </button>
        </div>
        <span className="succ-timer" aria-hidden />
      </div>
    </div>
  );
}
