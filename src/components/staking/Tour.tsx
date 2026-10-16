"use client";

/**
 * @file Guided first-visit tour: spotlight + card that follows target elements smoothly.
 */
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
  const [ready, setReady] = useState(false);
  const [cardPos, setCardPos] = useState<React.CSSProperties | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => !readSeen() && setI(0), 1100);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (openSignal > 0) setI(0);
  }, [openSignal]);

  // Steps are rebuilt every render (live data); key effects on the index, read steps via ref.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const step = i >= 0 ? steps[i] : null;

  const targetEl = useCallback(() => {
    const s = i >= 0 ? stepsRef.current[i] : null;
    return s?.target ? (document.querySelector(s.target) as HTMLElement | null) : null;
  }, [i]);

  // Step change: hide card, run before(), scroll target into a comfortable spot,
  // wait until scrolling has settled, then reveal spotlight + card together.
  useLayoutEffect(() => {
    if (i < 0) return;
    const s = stepsRef.current[i];
    setReady(false);
    s.before?.();
    // make sure scroll-reveal content is visible while touring
    document.querySelectorAll("[data-rv],[data-rv-kids]").forEach((el) => el.classList.add("in"));
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    const go = () => {
      const el = targetEl();
      if (!el) {
        setRect(null);
        setReady(true);
        return;
      }
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const header = 72;
      const room = vh - header;
      const desired = r.height < room * 0.6 ? header + (room - r.height) * 0.3 : header + 12;
      const target = window.scrollY + r.top - desired;
      window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      let last = -1;
      let stable = 0;
      const wait = () => {
        if (cancelled) return;
        const y = window.scrollY;
        stable = Math.abs(y - last) < 0.5 ? stable + 1 : 0;
        last = y;
        if (stable >= 5 || performance.now() - start > 1200) {
          setRect(el.getBoundingClientRect());
          setReady(true);
        } else raf = requestAnimationFrame(wait);
      };
      raf = requestAnimationFrame(wait);
    };
    // let tab switches / layout settle first
    const t = window.setTimeout(go, s.before ? 320 : 40);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [i, targetEl]);

  // Follow manual scroll / resize smoothly.
  useEffect(() => {
    if (i < 0 || !ready) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = targetEl();
        if (el) setRect(el.getBoundingClientRect());
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [i, ready, targetEl]);

  // Place the card using its real size: below → above → beside → pinned to the bottom.
  useLayoutEffect(() => {
    if (!ready || !cardRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = cardRef.current.getBoundingClientRect();
    const w = Math.min(400, vw - 24);
    const gap = 16;
    if (!rect) {
      setCardPos({ left: "50%", top: "50%", width: Math.min(460, vw - 24) });
      return;
    }
    if (vw < 640) {
      setCardPos({ left: 12, right: 12, bottom: 12 });
      return;
    }
    const h = card.height;
    const left = Math.min(Math.max(12, rect.left), vw - w - 12);
    if (rect.bottom + gap + h < vh - 12) return setCardPos({ top: rect.bottom + gap, left, width: w });
    if (rect.top - gap - h > 72) return setCardPos({ top: rect.top - gap - h, left, width: w });
    if (rect.right + gap + w < vw - 12)
      return setCardPos({ top: Math.min(Math.max(84, rect.top), vh - h - 12), left: rect.right + gap, width: w });
    if (rect.left - gap - w > 12)
      return setCardPos({ top: Math.min(Math.max(84, rect.top), vh - h - 12), left: rect.left - gap - w, width: w });
    setCardPos({ bottom: 16, left: vw - w - 16, width: w });
  }, [ready, rect, i]);

  const close = useCallback(() => {
    writeSeen();
    setI(-1);
    setRect(null);
    setReady(false);
  }, []);

  useEffect(() => {
    if (i < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, stepsRef.current.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [i, close]);

  if (!step) return null;

  const last = i === steps.length - 1;
  const pad = 8;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // clip very tall targets to the visible area so the spotlight never runs off-screen
  const spot = rect
    ? {
        top: Math.max(64, rect.top - pad),
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: Math.min(rect.bottom + pad, vh - 8) - Math.max(64, rect.top - pad),
      }
    : null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className={`tour-dim ${spot ? "off" : ""}`} />
      <div className={`tour-spot ${spot ? "" : "off"}`} style={spot ?? undefined} />
      <div
        ref={cardRef}
        className={`tour-card ${ready && cardPos ? "show" : ""} ${!rect ? "center" : ""}`}
        style={cardPos ?? { left: -9999, top: 0, width: 380 }}
      >
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
