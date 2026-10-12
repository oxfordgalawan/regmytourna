"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data on an interval and shows a live clock — for unattended TV screens. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [router, seconds]);

  return (
    <span className="display text-5xl text-bone tabular-nums" suppressHydrationWarning>
      {now?.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}
    </span>
  );
}
