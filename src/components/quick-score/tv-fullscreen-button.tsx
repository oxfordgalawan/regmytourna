"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";

export function TvFullscreenButton() {
  const [active, setActive] = useState(false);

  const sync = useCallback(() => {
    setActive(Boolean(document.fullscreenElement));
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [sync]);

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* browser blocked — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className={cn(
        "fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50",
        "flex size-11 items-center justify-center rounded-full border border-bone/20 bg-ink/60 text-bone backdrop-blur-md",
        "transition hover:border-bone/40 hover:bg-ink/80"
      )}
      aria-label={active ? "Exit full screen" : "Full screen"}
      title={active ? "Exit full screen" : "Full screen"}
    >
      {active ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
    </button>
  );
}