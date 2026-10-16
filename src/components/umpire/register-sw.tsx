"use client";

import { useEffect } from "react";

/**
 * Installs the umpire service worker (scope /umpire/) so scoring pages reopen
 * offline. Production only — in dev it would cache hot-reloaded chunks.
 */
export function RegisterUmpireSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/umpire-sw.js", { scope: "/umpire/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (cancelled) return;
        // cache this page and everything it already loaded
        const urls = [
          window.location.href,
          ...performance.getEntriesByType("resource").map((e) => e.name),
        ];
        reg.active?.postMessage({ type: "precache", urls });
      })
      .catch(() => {
        // offline support is a bonus; scoring still saves to the device
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
