"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "infra-theme";
export type Theme = "light" | "dark";

/** Inline script for <head>: light by default; dark only if the visitor chose it (applied before paint). */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='dark'){t='light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

/** Current theme, kept in sync with <html data-theme>. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export function ThemeToggle() {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  };

  return (
    <button className="theme-btn" onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
