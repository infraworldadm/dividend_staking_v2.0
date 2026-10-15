"use client";

import { useEffect, useMemo, useState } from "react";

export function useCountdown(targetTimestamp: number) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => {
      setNow(Math.floor(Date.now() / 1000));
    };

    tick();
    const id = window.setInterval(() => {
      tick();
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (now === 0 || targetTimestamp === 0) return 0;
    return Math.max(targetTimestamp - now, 0);
  }, [targetTimestamp, now]);
}
