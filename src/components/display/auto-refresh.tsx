"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { safeRouterRefresh } from "@/lib/navigation/safe-refresh";

/** Re-fetches server data on an interval and shows a live clock — for unattended TV screens. */
export function AutoRefresh({ seconds = 15, clock = true }: { seconds?: number; clock?: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [, startRefresh] = useTransition();

  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const runRefresh = () => startRefresh(() => safeRouterRefresh(router));

    const refresh = window.setInterval(runRefresh, seconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(runRefresh, 300);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(tick);
      window.clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  if (!clock) return null;
  return (
    <span className="display text-5xl text-bone tabular-nums" suppressHydrationWarning>
      {now?.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}
    </span>
  );
}
