"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type TourStep = {
  /** CSS selector of the element to highlight; omit for a centered card. */
  target?: string;
  title: string;
  body: ReactNode;
  /** Runs before the step is shown (e.g. switch tab). */
  before?: () => void;
};

const SEEN_KEY = "infra-staking-tour-v1";

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag
  }
}
function writeSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Opens automatically once per browser; `openSignal` increments to replay. */
export function Tour({ steps, openSignal }: { steps: TourStep[]; openSignal: number }) {
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const t = setTimeout(() => !readSeen() && setI(0), 900);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (openSignal > 0) setI(0);
  }, [openSignal]);

  const step = i >= 0 ? steps[i] : null;
  // Steps are rebuilt every render (live data); key effects on the index, read steps via ref.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const measure = useCallback(() => {
    const s = i >= 0 ? stepsRef.current[i] : null;
    if (!s?.target) return setRect(null);
    const el = document.querySelector(s.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [i]);

  useLayoutEffect(() => {
    const step = i >= 0 ? stepsRef.current[i] : null;
    if (!step) return;
    step.before?.();
    const id = window.setTimeout(() => {
      const el = step.target ? document.querySelector(step.target) : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(measure, 380);
    }, 60);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [i, measure]);

  const close = useCallback(() => {
    writeSeen();
    setI(-1);
    setRect(null);
  }, []);

  useEffect(() => {
    if (i < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [i, close, steps.length]);

  if (!step) return null;

  const last = i === steps.length - 1;
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const mobile = vw < 640;
  const cardW = Math.min(380, vw - 24);

  let cardStyle: React.CSSProperties;
  if (!rect || mobile) {
    cardStyle = mobile && rect
      ? { left: 12, right: 12, bottom: 12 }
      : { left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: Math.min(460, vw - 24) };
  } else {
    const below = rect.bottom + pad + 14;
    const fitsBelow = below + 260 < vh;
    const top = fitsBelow ? below : Math.max(12, rect.top - pad - 14 - 260);
    const left = Math.min(Math.max(12, rect.left), vw - cardW - 12);
    cardStyle = { top, left, width: cardW };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={cardStyle} key={i}>
        <div className="flex items-center justify-between">
          <span className="lbl b">
            <i /> Step {i + 1} of {steps.length}
          </span>
          <button className="tour-x" onClick={close} aria-label="Close tour">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-[1.08rem] font-semibold tracking-[-0.02em]">{step.title}</h3>
        <div className="tour-body">{step.body}</div>
        <div className="tour-dots" aria-hidden>
          {steps.map((_, n) => (
            <i key={n} className={n === i ? "on" : n < i ? "done" : ""} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button className="text-[0.82rem] text-[var(--t3)] hover:text-[var(--t1)]" onClick={close}>
            {last ? "" : "Skip tour"}
          </button>
          <div className="flex gap-2">
            {i > 0 ? (
              <button className="btn btn-sm !bg-[var(--field)] !text-[var(--t1)]" onClick={() => setI(i - 1)} aria-label="Back">
                <ArrowLeft />
              </button>
            ) : null}
            <button className="btn btn-k btn-sm" onClick={() => (last ? close() : setI(i + 1))}>
              {last ? "Start staking" : i === 0 ? "Show me" : "Next"} <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
