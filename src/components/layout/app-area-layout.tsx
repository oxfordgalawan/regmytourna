"use client";

import { usePathname } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export function AppAreaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/super-admin")) {
    return <>{children}</>;
  }

  return (
    <PageShell>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-20 sm:px-6 md:grid-cols-[13rem_1fr] md:gap-12 md:pt-12">
        <aside>
          <DashboardNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PageShell>
  );
}
