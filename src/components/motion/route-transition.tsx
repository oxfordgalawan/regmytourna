"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

const pageClasses = {
  "nav-forward": "vt-forward",
  "nav-back": "vt-back",
  // tab switches are animated by the inner tab boundary, not the page
  "tab-forward": "none",
  "tab-back": "none",
  default: "vt-page",
};

const tabClasses = {
  "tab-forward": "vt-tab-forward",
  "tab-back": "vt-tab-back",
  default: "vt-page",
};

/** Routes that render their own full-screen shell (no shared header/sidebar). */
function areaKey(pathname: string) {
  if (/^\/(dashboard|organizer|settings)(\/|$)/.test(pathname)) return "app";
  if (pathname.startsWith("/super-admin")) return "admin";
  if (/^\/(login|signup|forgot-password|reset-password|court|display|umpire)(\/|$)/.test(pathname)) {
    return pathname;
  }
  return "public";
}

/** Organizer event tabs share one key so the event header doesn't re-animate per tab. */
function sectionKey(pathname: string) {
  const event = pathname.match(/^\/organizer\/tournaments\/(?!new(?:\/|$))[^/]+/);
  return event ? event[0] : pathname;
}

type Scope = "area" | "section" | "tab";

/**
 * Wraps a region whose content changes on navigation. A new `key` mounts a
 * fresh boundary, so React snapshots old → new and the CSS in globals.css
 * animates the swap. Nested scopes split the work: the app shell (area), the
 * content column (section), and the event tab panel (tab).
 */
export function RouteTransition({
  scope,
  className = "min-w-0",
  children,
}: {
  scope: Scope;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const key =
    scope === "area" ? areaKey(pathname) : scope === "section" ? sectionKey(pathname) : pathname;
  const classes = scope === "tab" ? tabClasses : pageClasses;

  return (
    <ViewTransition
      key={key}
      enter={classes}
      exit={classes}
      // only the innermost content regions crossfade on in-place updates
      // (filters, skeleton → data); the outer shell never does
      update={scope === "area" ? "none" : "vt-fade"}
      default="none"
    >
      {/* display:contents would drop the box React snapshots */}
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
