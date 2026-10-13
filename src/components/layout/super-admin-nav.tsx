"use client";

import Link from "next/link";
import { ArrowUpRight, LayoutDashboard, Shield, Trophy, UserCircle, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import type { SideNavLink } from "@/components/layout/side-nav";

const consoleLinks: SideNavLink[] = [
  { href: "/super-admin", label: "Overview", icon: Shield, exact: true },
  { href: "/super-admin/organizers", label: "Organizers", icon: Users },
  { href: "/super-admin/tournaments", label: "Events", icon: Trophy },
  { href: "/super-admin/players", label: "Players", icon: UserCircle },
  { href: "/super-admin/withdrawals", label: "Payouts", icon: Wallet },
];

const experienceLinks = [
  { href: "/dashboard", label: "Player experience", icon: LayoutDashboard },
  { href: "/organizer/tournaments", label: "Organizer console", icon: Trophy },
];

/** Super-admin console frame: same shell as the app, plus "switch view" shortcuts. */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      links={consoleLinks}
      label="Super admin"
      sidebarExtra={
        <div>
          <p className="eyebrow mb-2 px-3">Switch view</p>
          <nav className="flex flex-col gap-1" aria-label="Experience shortcuts">
            {experienceLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-2 rounded-lg border border-umber/60 bg-umber/10 px-3 py-2.5 text-sm font-medium text-bone transition-colors hover:border-brass hover:bg-umber/25"
              >
                <span className="flex items-center gap-2">
                  <link.icon className="size-4 text-brass" aria-hidden />
                  {link.label}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </nav>
        </div>
      }
      mobileExtra={
        <nav className="flex gap-2 overflow-x-auto scrollbar-none" aria-label="Experience shortcuts">
          {experienceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-umber/60 bg-umber/10 px-3 py-1.5 text-xs text-bone"
            >
              <link.icon className="size-3.5 text-brass" aria-hidden />
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
