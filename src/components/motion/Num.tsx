"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a formatted number string (e.g. "1,234.50") between values; non-numeric strings render as-is. */
export function Num({ value, duration = 900 }: { value: string; duration?: number }) {
  const parse = (v: string) => (/^-?[\d,]+(\.\d+)?$/.test(v) ? Number(v.replace(/,/g, "")) : null);
  const decimals = value.includes(".") ? value.split(".")[1].length : 0;
  const target = parse(value);
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const from = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) {
      setShown(value);
      return;
    }
    const start = from.current ?? 0;
    from.current = target;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    setBump(true);
    const fmt = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(fmt(start + (target - start) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setBump(false), 300);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={`num${bump ? " bump" : ""}`}>{shown}</span>;
}
