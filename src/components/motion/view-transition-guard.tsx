"use client";

/**
 * React ignores a view transition the browser skips because the tab went
 * hidden, but only when the message matches exactly. Newer Chrome appends
 * ". Document hidden", so the abort surfaces as an InvalidStateError on every
 * background refresh. Normalise those rejections to the wording React expects.
 */
const REACT_IGNORED = "Transition was aborted because of invalid state";

function normalise(error: unknown): unknown {
  if (
    error instanceof DOMException &&
    error.name === "InvalidStateError" &&
    error.message !== REACT_IGNORED &&
    /invalid state|hidden|visibility/i.test(error.message)
  ) {
    return new DOMException(REACT_IGNORED, "InvalidStateError");
  }
  return error;
}

function install() {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return;
  const doc = document as Document & { __vtGuard?: boolean };
  if (doc.__vtGuard) return;
  doc.__vtGuard = true;

  const original = document.startViewTransition.bind(document);
  document.startViewTransition = ((arg?: Parameters<Document["startViewTransition"]>[0]) => {
    const t = original(arg);
    const ready = t.ready.catch((e) => Promise.reject(normalise(e)));
    const finished = t.finished.catch((e) => Promise.reject(normalise(e)));
    const updateCallbackDone = t.updateCallbackDone.catch((e) => Promise.reject(normalise(e)));
    // avoid unhandled-rejection noise from copies nobody awaits
    for (const p of [ready, finished, updateCallbackDone]) p.catch(() => {});
    return {
      ready,
      finished,
      updateCallbackDone,
      skipTransition: () => t.skipTransition(),
      get types() {
        return (t as ViewTransition & { types?: unknown }).types;
      },
    } as unknown as ViewTransition;
  }) as Document["startViewTransition"];
}

install();

export function ViewTransitionGuard() {
  return null;
}
