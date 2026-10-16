"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Gauge,
  Layers,
  LayoutGrid,
  Swords,
  GitBranch,
  UserCheck,
  FileText,
  Users,
  ListOrdered,
  UsersRound,
} from "lucide-react";
import { useSlidingIndicator } from "@/components/motion/use-sliding-indicator";
import { TAB_BACK, TAB_FORWARD } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";

const allItems = [
  { suffix: "", label: "Overview", icon: Gauge },
  { suffix: "/divisions", label: "Categories", icon: Layers },
  { suffix: "/registrations", label: "Registrations", icon: ClipboardList },
  { suffix: "/petitions", label: "Petitions", icon: FileText },
  { suffix: "/draw", label: "Brackets", icon: GitBranch },
  { suffix: "/matches", label: "Matches", icon: Swords },
  { suffix: "/queue", label: "Queue", icon: ListOrdered },
  { suffix: "/courts", label: "Courts", icon: LayoutGrid },
  { suffix: "/umpires", label: "Umpires", icon: UserCheck },
  { suffix: "/team", label: "Team", icon: UsersRound },
];

export function TournamentNav({ tournamentId, bracketOnly = false }: { tournamentId: string; bracketOnly?: boolean }) {
  const pathname = usePathname();
  // bracket-only events: the roster is "Players" (imported) and there are no petitions
  const items = bracketOnly
    ? allItems
        .filter((i) => i.suffix !== "/petitions")
        .map((i) => (i.suffix === "/registrations" ? { ...i, label: "Players", icon: Users } : i))
    : allItems;
  const base = `/organizer/tournaments/${tournamentId}`;
  // sub-pages (e.g. one category's draw) keep their tab highlighted
  const activeIndex = items.findIndex(
    (item) =>
      pathname === `${base}${item.suffix}` || (item.suffix !== "" && pathname.startsWith(`${base}${item.suffix}/`))
  );
  const { ref, style } = useSlidingIndicator<HTMLElement>(activeIndex);

  return (
    <nav
      ref={ref}
      className="relative -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0"
      aria-label="Tournament sections"
    >
      {items.map((item, i) => {
        const href = `${base}${item.suffix}`;
        const active = i === activeIndex;
        return (
          <Link
            key={href}
            href={href}
            // slide the panel toward the tab you picked
            transitionTypes={i > activeIndex ? TAB_FORWARD : TAB_BACK}
            data-active={active}
            aria-current={active ? "page" : undefined}
            aria-label={item.suffix === "/draw" ? "Brackets and seeding" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-t-md px-3 pt-2 pb-3.5 text-sm font-medium transition-colors duration-300",
              active ? "text-bone" : "text-muted-foreground hover:bg-espresso/40 hover:text-bone"
            )}
          >
            <item.icon
              className={cn("size-4 transition-colors duration-300", active && "text-brass")}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
      {/* underline: only the bottom 2px of the measured box is painted */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 flex items-end px-2"
        style={style}
      >
        <span className="h-0.5 w-full rounded-full bg-bone" />
      </span>
    </nav>
  );
}
