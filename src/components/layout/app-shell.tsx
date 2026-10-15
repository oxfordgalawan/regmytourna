"use client";

import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SideNav, type SideNavLink } from "@/components/layout/side-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { RouteTransition } from "@/components/motion/route-transition";

/**
 * Signed-in app frame (no marketing header/footer):
 * - lg+: fixed sidebar, content uses the full remaining width
 * - below lg: slim top bar + bottom tab bar
 * `--app-bottom-nav` lets sticky footers inside pages sit above the tab bar.
 */
export function AppShell({
  links,
  label,
  primaryAction,
  sidebarExtra,
  mobileExtra,
  children,
}: {
  links: SideNavLink[];
  label: string;
  primaryAction?: { href: string; label: string; icon?: "plus" | "search" };
  sidebarExtra?: React.ReactNode;
  mobileExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col [--app-bottom-nav:calc(4.25rem+env(safe-area-inset-bottom))] lg:pl-64 lg:[--app-bottom-nav:0px]">
      {/* Desktop sidebar */}
      <aside
        style={{ viewTransitionName: "app-sidebar" }}
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex"
      >
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pt-2 pb-4 scrollbar-none">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="group flex items-center gap-3 rounded-xl bg-bone px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#f0ebdc]"
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-ink/10 transition-transform group-hover:rotate-90">
                {primaryAction.icon === "search" ? <Search className="size-4" /> : <Plus className="size-4" />}
              </span>
              {primaryAction.label}
            </Link>
          )}
          <SideNav links={links} label={label} />
          {sidebarExtra}
        </div>
        <div className="space-y-1 border-t border-line p-3">
          <Link
            href="/"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-espresso/50 hover:text-bone"
          >
            Public site
            <ArrowUpRight className="size-3.5" />
          </Link>
          <div className="flex justify-end px-2 py-1">
            <UserAccountMenu size="sm" />
          </div>
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header
        style={{ viewTransitionName: "app-topbar" }}
        className="sticky top-0 z-40 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur-md sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] lg:hidden"
      >
        <div className="flex h-14 items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-3">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              aria-label={primaryAction.label}
              className="flex size-9 items-center justify-center rounded-full bg-bone text-ink active:scale-95"
            >
              {primaryAction.icon === "search" ? <Search className="size-4" /> : <Plus className="size-4" />}
            </Link>
          )}
          <UserAccountMenu size="sm" />
        </div>
        </div>
        {/* view switches ride in the sticky bar so they're always reachable */}
        {mobileExtra && <div className="pb-2.5">{mobileExtra}</div>}
      </header>

      <main
        id="main"
        className="w-full flex-1 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(var(--app-bottom-nav)+2rem)] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 lg:px-10 lg:pt-10 xl:px-14"
      >
        <RouteTransition scope="section">{children}</RouteTransition>
      </main>

      <BottomNav links={links} label={label} />
    </div>
  );
}
