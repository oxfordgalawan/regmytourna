import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** True when view transitions are allowed (tab visible and focused enough to paint). */
export function canRunViewTransition() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && !document.hidden;
}

/**
 * Soft refresh without starting a transition while the document is hidden
 * (file picker, background tab, etc.). Browsers throw InvalidStateError otherwise.
 */
export function safeRouterRefresh(router: AppRouterInstance) {
  if (!canRunViewTransition()) return;
  requestAnimationFrame(() => {
    if (!canRunViewTransition()) return;
    router.refresh();
  });
}
