"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Gauge,
  Layers,
  LayoutGrid,
  Swords,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { suffix: "", label: "Overview", icon: Gauge },
  { suffix: "/divisions", label: "Divisions", icon: Layers },
  { suffix: "/registrations", label: "Registrations", icon: ClipboardList },
  { suffix: "/matches", label: "Matches", icon: Swords },
  { suffix: "/courts", label: "Courts", icon: LayoutGrid },
  { suffix: "/scoring", label: "Scoring", icon: Timer },
];

export function TournamentNav({ tournamentId }: { tournamentId: string }) {
  const pathname = usePathname();
  const base = `/organizer/tournaments/${tournamentId}`;

  return (
    <nav
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0"
      aria-label="Tournament sections"
    >
      {items.map((item) => {
        const href = `${base}${item.suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3 pt-2 pb-3.5 text-sm font-medium transition-colors",
              active ? "text-bone" : "text-muted-foreground hover:text-bone"
            )}
          >
            <item.icon className={cn("size-4", active && "text-brass")} aria-hidden />
            {item.label}
            <span
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-bone transition-transform duration-300",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
