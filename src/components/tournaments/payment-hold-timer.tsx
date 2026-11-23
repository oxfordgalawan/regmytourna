"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaymentHoldTimer({
  expiresAt,
  className,
  onExpire,
}: {
  expiresAt: string;
  className?: string;
  onExpire?: () => void;
}) {
  const end = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => end - Date.now());

  useEffect(() => {
    const tick = () => {
      const next = end - Date.now();
      setRemaining(next);
      if (next <= 0) onExpire?.();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end, onExpire]);

  const label = formatRemaining(remaining);
  const urgent = remaining > 0 && remaining < 5 * 60_000;

  return (
    <span
      className={cn("font-mono tabular-nums", urgent ? "text-[#e58a72]" : "text-brass", className)}
      aria-live="polite"
    >
      {remaining <= 0 ? "0:00" : label}
    </span>
  );
}