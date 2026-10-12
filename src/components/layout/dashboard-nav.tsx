"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutDashboard, Plus, Settings, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/organizer/tournaments", label: "My events", icon: Trophy },
  { href: "/organizer/wallet", label: "Wallet", icon: Wallet },
  { href: "/tournaments", label: "Browse", icon: Compass },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <div className="md:sticky md:top-24">
      <nav
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-3 scrollbar-none md:mx-0 md:flex-col md:border-b-0 md:px-0 md:pb-0"
        aria-label="Dashboard"
      >
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-espresso text-bone"
                  : "text-muted-foreground hover:bg-espresso/50 hover:text-bone"
              )}
            >
              {active && (
                <span className="absolute top-2 bottom-2 left-0 hidden w-0.5 rounded-full bg-brass md:block" />
              )}
              <link.icon className={cn("size-4", active ? "text-brass" : "")} aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/organizer/tournaments/new"
        className="mt-6 hidden items-center gap-3 rounded-xl border border-dashed border-umber px-3 py-3 text-sm text-bone/80 transition-colors hover:border-brass hover:bg-umber/20 hover:text-bone md:flex"
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-umber">
          <Plus className="size-4" />
        </span>
        New tournament
      </Link>
    </div>
  );
}
