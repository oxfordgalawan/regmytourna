"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "done";

function isInternalNavigation(e: MouseEvent, anchor: HTMLAnchorElement) {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // same page (or just a #hash jump) — nothing to load
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const hideTimer = useRef<number | undefined>(undefined);

  // Start when an internal link is clicked or a GET form is submitted.
  useEffect(() => {
    const start = () => {
      window.clearTimeout(hideTimer.current);
      setPhase("loading");
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(e, anchor)) start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (form instanceof HTMLFormElement && form.method === "get" && !e.defaultPrevented) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  // Finish when the URL actually changes.
  const url = `${pathname}?${searchParams}`;
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    if (phase === "loading") setPhase("done");
  }

  // safety net: a click that never changes the URL (redirect to same page, error)
  useEffect(() => {
    if (phase !== "loading") return;
    const t = window.setTimeout(() => setPhase("done"), 10_000);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    hideTimer.current = window.setTimeout(() => setPhase("idle"), 450);
    return () => window.clearTimeout(hideTimer.current);
  }, [phase]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5"
      style={{ viewTransitionName: "nav-progress" }}
    >
      <div
        className={
          phase === "idle"
            ? "h-full origin-left scale-x-0 opacity-0"
            : phase === "loading"
              ? "h-full origin-left bg-brass shadow-[0_0_12px_var(--brass)] [animation:progress-crawl_8s_cubic-bezier(0.1,0.7,0.2,1)_forwards]"
              : "h-full origin-left scale-x-100 bg-brass opacity-0 transition-[transform,opacity] duration-300 [transition-delay:0ms,150ms]"
        }
      />
    </div>
  );
}

/** Thin brass bar across the top that shows a navigation is in flight. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
