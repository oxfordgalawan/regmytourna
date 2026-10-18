"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { organizerLinks, playerLinks } from "@/components/layout/dashboard-nav";
import { RoleSwitch, RoleSwitchLanding, SwitchLink } from "@/components/layout/role-switch";
import type { AppRole } from "@/lib/auth/role";

export function AppAreaLayout({
  role,
  hasPlayer,
  hasOrganizer,
  superAdmin = false,
  organizerActAs = false,
  children,
}: {
  /** the experience to show */
  role: AppRole;
  /** roles the user has switched on — the switch asks before enabling a new one */
  hasPlayer: boolean;
  hasOrganizer: boolean;
  /** super admins also get a way back to the admin console */
  superAdmin?: boolean;
  /** super admin viewing as another organizer — hide create-event shortcuts */
  organizerActAs?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // the super-admin console renders its own shell
  if (pathname?.startsWith("/super-admin")) {
    return <>{children}</>;
  }

  const other: AppRole = role === "organizer" ? "player" : "organizer";
  const enabled = other === "organizer" ? hasOrganizer : hasPlayer;

  const sidebarExtra = (
    <div className="space-y-2">
      {superAdmin && <p className="eyebrow px-3">Switch view</p>}
      <RoleSwitch to={other} enabled={enabled} />
      {superAdmin && <SwitchLink kind="admin" href="/super-admin" label="Admin console" />}
    </div>
  );
  const mobileExtra = (
    <div className="flex gap-2 overflow-x-auto scrollbar-none">
      <RoleSwitch to={other} enabled={enabled} compact />
      {superAdmin && <SwitchLink kind="admin" href="/super-admin" label="Admin console" compact />}
    </div>
  );

  return (
    <>
      <RoleSwitchLanding />
      {role === "organizer" ? (
        <AppShell
          links={organizerLinks}
          label="Main"
          primaryAction={
            organizerActAs
              ? undefined
              : { href: "/organizer/tournaments/new", label: "New tournament" }
          }
          sidebarExtra={sidebarExtra}
          mobileExtra={mobileExtra}
        >
          {children}
        </AppShell>
      ) : (
        <AppShell
          links={playerLinks}
          label="Main"
          primaryAction={{ href: "/explore", label: "Find a tournament", icon: "search" }}
          sidebarExtra={sidebarExtra}
          mobileExtra={mobileExtra}
        >
          {children}
        </AppShell>
      )}
    </>
  );
}
