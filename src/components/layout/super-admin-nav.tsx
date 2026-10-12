"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  LayoutDashboard,
  Shield,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const consoleLinks = [
  { href: "/super-admin", label: "Overview", icon: Shield, exact: true },
  { href: "/super-admin/organizers", label: "Organizers", icon: Users },
  { href: "/super-admin/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/super-admin/players", label: "Players", icon: UserCircle },
];

const experienceLinks = [
  { href: "/dashboard", label: "Player experience", icon: LayoutDashboard },
  { href: "/organizer/tournaments", label: "Organizer console", icon: Trophy },
];

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <div className="md:sticky md:top-24">
      <p className="eyebrow mb-3 hidden px-3 md:block">Platform</p>
      <nav
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-3 scrollbar-none md:mx-0 md:flex-col md:border-b-0 md:px-0 md:pb-0"
        aria-label="Super admin"
      >
        {consoleLinks.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + "/");
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

      <p className="eyebrow mb-3 mt-8 hidden px-3 md:block">Switch view</p>
      <nav
        className="mt-4 flex gap-2 md:mt-0 md:flex-col md:gap-1"
        aria-label="Experience shortcuts"
      >
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
  );
}
