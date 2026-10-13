"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { dashboardLinks } from "@/components/layout/dashboard-nav";

export function AppAreaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // the super-admin console renders its own shell
  if (pathname?.startsWith("/super-admin")) {
    return <>{children}</>;
  }

  return (
    <AppShell
      links={dashboardLinks}
      label="Main"
      primaryAction={{ href: "/organizer/tournaments/new", label: "New tournament" }}
    >
      {children}
    </AppShell>
  );
}
