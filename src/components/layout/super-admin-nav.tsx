"use client";

import { Shield, Trophy, UserCircle, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { RoleSwitchLanding, SwitchLink } from "@/components/layout/role-switch";
import type { SideNavLink } from "@/components/layout/side-nav";

const consoleLinks: SideNavLink[] = [
  { href: "/super-admin", label: "Overview", icon: Shield, exact: true },
  { href: "/super-admin/organizers", label: "Organizers", icon: Users },
  { href: "/super-admin/tournaments", label: "Events", icon: Trophy },
  { href: "/super-admin/players", label: "Players", icon: UserCircle },
  { href: "/super-admin/withdrawals", label: "Payouts", icon: Wallet },
];

/** Super-admin console frame: same shell as the app, plus animated "switch view" shortcuts. */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* reveal after arriving here from the player / organizer app */}
      <RoleSwitchLanding />
      <AppShell
        links={consoleLinks}
        label="Super admin"
        sidebarExtra={
          <div className="space-y-2">
            <p className="eyebrow px-3">Switch view</p>
            <SwitchLink kind="player" href="/view/player" label="Player experience" />
            <SwitchLink kind="organizer" href="/view/organizer" label="Organizer console" />
          </div>
        }
        mobileExtra={
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <SwitchLink kind="player" href="/view/player" label="Player experience" compact />
            <SwitchLink kind="organizer" href="/view/organizer" label="Organizer console" compact />
          </div>
        }
      >
        {children}
      </AppShell>
    </>
  );
}
