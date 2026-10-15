"use client";

import { useEffect } from "react";

/**
 * Page-wide motion wiring (no deps):
 * - reveals [data-rv] / [data-rv-kids] as they enter the viewport (incl. nodes added later, e.g. tab switches)
 * - feeds pointer position to .tile as --mx/--my for the cursor-follow edge glow
 */
export function Motion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    const scan = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>("[data-rv]:not(.in), [data-rv-kids]:not(.in)").forEach((el) => {
        if (reduce) el.classList.add("in");
        else io.observe(el);
      });
    scan(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n.parentElement || n));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    let raf = 0;
    const move = (ev: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const tile = (ev.target as HTMLElement | null)?.closest?.(".tile") as HTMLElement | null;
        if (!tile) return;
        const r = tile.getBoundingClientRect();
        tile.style.setProperty("--mx", `${ev.clientX - r.left}px`);
        tile.style.setProperty("--my", `${ev.clientY - r.top}px`);
      });
    };
    if (!reduce) window.addEventListener("pointermove", move, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}
