"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { umpireSignOutAction } from "@/app/actions/umpire";
import { FilterChips } from "@/components/ui/filter-chips";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export type BoardMatch = {
  id: string;
  status: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  gamesA: number;
  gamesB: number;
  divisionId: string | null;
  divisionName: string | null;
  courtName: string | null;
  label: string;
};

const SECTIONS = [
  { key: "live", title: "Live", match: (m: BoardMatch) => m.status === "in_progress" },
  { key: "next", title: "Up next", match: (m: BoardMatch) => m.status === "scheduled" },
  { key: "done", title: "Finished", match: (m: BoardMatch) => m.status === "completed" },
] as const;

/** Umpire's list of matches: tap one to open its scoresheet. */
export function MatchBoard({
  tournamentId,
  tournamentName,
  divisions,
  matches,
  isUmpire,
}: {
  tournamentId: string;
  tournamentName: string;
  divisions: { id: string; name: string }[];
  matches: BoardMatch[];
  isUmpire: boolean;
}) {
  const router = useRouter();
  const [division, setDivision] = useState<string>("all");
  const [showDone, setShowDone] = useState(false);
  const visible = matches.filter((m) => division === "all" || m.divisionId === division);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Umpire · match board</p>
          <h1 className="display mt-2 truncate text-4xl text-bone">{tournamentName}</h1>
        </div>
        {isUmpire && (
          <button
            type="button"
            onClick={async () => {
              await umpireSignOutAction(tournamentId);
              router.refresh();
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted-foreground hover:text-bone"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        )}
      </header>

      {divisions.length > 1 && (
        <FilterChips
          className="sticky top-0 z-10 -mx-4 mt-6 bg-ink/90 px-4 py-3 backdrop-blur-md"
          label="Category"
          chips={[
            { key: "all", label: "All", active: division === "all", onSelect: () => setDivision("all") },
            ...divisions.map((d) => ({
              key: d.id,
              label: d.name,
              active: division === d.id,
              onSelect: () => setDivision(d.id),
            })),
          ]}
        />
      )}

      {matches.length === 0 && (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          No matches yet. They appear here once the organizer syncs the brackets.
        </p>
      )}

      {SECTIONS.map((section) => {
        const list = visible.filter(section.match);
        if (!list.length) return null;
        const collapsed = section.key === "done" && !showDone;
        return (
          <section key={section.key} className="mt-8">
            <h2 className="eyebrow mb-3 flex items-center gap-2">
              {section.key === "live" && <span className="size-1.5 animate-pulse-dot rounded-full bg-rust" />}
              {section.title} · {list.length}
            </h2>
            {collapsed ? (
              <button
                type="button"
                onClick={() => setShowDone(true)}
                className="w-full rounded-2xl border border-dashed border-line py-3 text-sm text-muted-foreground hover:text-bone"
              >
                Show finished matches
              </button>
            ) : (
              <ul className="space-y-2">
                {list.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/umpire/${tournamentId}/match/${m.id}`}
                      transitionTypes={NAV_FORWARD}
                      className={cn(
                        "group flex items-center gap-4 rounded-2xl border p-4 transition-all active:scale-[0.99]",
                        m.status === "in_progress"
                          ? "border-umber bg-espresso"
                          : "border-line bg-surface hover:border-umber",
                        m.status === "completed" && "opacity-70"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
                          {[m.divisionName, m.label, m.courtName].filter(Boolean).join(" · ")}
                        </p>
                        {[
                          { name: m.teamA, score: m.scoreA, games: m.gamesA },
                          { name: m.teamB, score: m.scoreB, games: m.gamesB },
                        ].map((t, i) => (
                          <div key={i} className="mt-1.5 flex items-center justify-between gap-3">
                            <span className="truncate text-bone">{t.name}</span>
                            {m.status !== "scheduled" && (
                              <span className="flex shrink-0 items-center gap-2 font-mono text-sm">
                                <span className="text-muted-foreground">{t.games}</span>
                                {m.status === "in_progress" && (
                                  <span className="display w-8 text-right text-2xl text-bone">{t.score}</span>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
