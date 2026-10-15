"use client";

import { Shield, Trophy, UserCircle, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { RoleSwitchLanding, ViewSwitcher } from "@/components/layout/role-switch";
import type { SideNavLink } from "@/components/layout/side-nav";

const consoleLinks: SideNavLink[] = [
  { href: "/super-admin", label: "Overview", icon: Shield, exact: true },
  { href: "/super-admin/organizers", label: "Organizers", icon: Users },
  { href: "/super-admin/tournaments", label: "Events", icon: Trophy },
  { href: "/super-admin/players", label: "Players", icon: UserCircle },
  { href: "/super-admin/withdrawals", label: "Withdrawals", icon: Wallet },
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
            <ViewSwitcher />
          </div>
        }
        mobileExtra={
          <ViewSwitcher compact />
        }
      >
        {children}
      </AppShell>
    </>
  );
}
