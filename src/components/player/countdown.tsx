"use client";

import { useEffect, useState } from "react";

/** Ticking days / hours / minutes until `date` (YYYY-MM-DD, local 8:00 AM start). */
export function Countdown({ date }: { date: string }) {
  const target = new Date(`${date.slice(0, 10)}T08:00:00`).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const ms = now === null ? null : Math.max(0, target - now);
  const parts = ms === null
    ? [["--", "days"], ["--", "hrs"], ["--", "min"]]
    : [
        [Math.floor(ms / 86_400_000), "days"],
        [Math.floor((ms % 86_400_000) / 3_600_000), "hrs"],
        [Math.floor((ms % 3_600_000) / 60_000), "min"],
      ];

  if (ms === 0) {
    return <p className="display text-3xl text-brass">Game day</p>;
  }

  return (
    <div className="flex items-end gap-3" aria-label="Time until the tournament starts">
      {parts.map(([value, unit]) => (
        <div key={String(unit)} className="min-w-12 text-center">
          <p className="display text-4xl leading-none text-bone tabular-nums sm:text-5xl" suppressHydrationWarning>
            {typeof value === "number" ? String(value).padStart(2, "0") : value}
          </p>
          <p className="mt-1 font-mono text-[0.6rem] tracking-widest text-muted-foreground uppercase">{unit}</p>
        </div>
      ))}
    </div>
  );
}
