"use client";

import { useMemo, useState } from "react";
import { ClaimMatchDialog } from "@/components/umpire/claim-match-dialog";
import { UmpireMatchAction } from "@/components/umpire/umpire-court-queue";
import type { QueueData, QueueMatch } from "@/lib/queue/load";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | "live";

/** Every match still to be played, across all categories — claim from here too. */
export function UmpireMatches({
  tournamentId,
  data,
  meId,
}: {
  tournamentId: string;
  data: QueueData;
  meId: string | null;
}) {
  const [claim, setClaim] = useState<QueueMatch | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");

  const courtName = useMemo(() => new Map(data.courts.map((c) => [c.id, c.name])), [data.courts]);
  const all = useMemo(
    () => [
      ...data.courts.flatMap((c) => c.live),
      ...data.liveElsewhere,
      ...data.courts.flatMap((c) => c.queued),
      ...data.ready,
    ],
    [data]
  );
  const usedCategories = data.categories.filter((c) => all.some((m) => m.divisionId === c.id));

  const shown = all.filter(
    (m) =>
      (category === "all" || m.divisionId === category) &&
      (filter === "all" ||
        (filter === "live" && m.status === "in_progress") ||
        (filter === "open" && m.status === "scheduled" && !m.umpireId))
  );

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
      active ? "border-bone bg-bone text-ink" : "border-line text-muted-foreground hover:text-bone"
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All · ${all.length}`],
            ["open", `Unassigned · ${all.filter((m) => m.status === "scheduled" && !m.umpireId).length}`],
            ["live", `Live · ${all.filter((m) => m.status === "in_progress").length}`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={chip(filter === key)} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>
      {usedCategories.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" className={chip(category === "all")} onClick={() => setCategory("all")}>
            All categories
          </button>
          {usedCategories.map((c) => (
            <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => setCategory(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">
          {all.length === 0 ? "No matches waiting to be played." : "No matches match these filters."}
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => {
            const mine = Boolean(meId && m.umpireId === meId);
            const court = m.courtId ? courtName.get(m.courtId) : null;
            const where =
              m.status === "in_progress"
                ? court
                  ? `Live on ${court}`
                  : "Live"
                : court
                  ? `${court} · ${m.position === 1 ? "next" : `#${m.position ?? "?"}`}`
                  : "Not queued";
            return (
              <li
                key={m.id}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl border bg-surface px-4 py-3",
                  m.status === "in_progress" ? "border-rust/40" : "border-line"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {m.divisionName} · {m.label}
                  </p>
                  <p className="mt-1 truncate text-sm text-bone">{m.teamA}</p>
                  <p className="truncate text-sm text-bone">
                    <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">vs</span>
                    {m.teamB}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className={m.status === "in_progress" ? "text-[#e58a72]" : undefined}>{where}</span>
                    {m.status === "in_progress" && ` · ${m.scoreA}–${m.scoreB}`}
                    {m.umpireName && <span className={mine ? "text-brass" : undefined}> · {mine ? "You" : m.umpireName}</span>}
                  </p>
                </div>
                <UmpireMatchAction tournamentId={tournamentId} m={m} meId={meId} onClaim={setClaim} />
              </li>
            );
          })}
        </ul>
      )}

      <ClaimMatchDialog
        open={Boolean(claim)}
        onOpenChange={(o) => !o && setClaim(null)}
        tournamentId={tournamentId}
        matchId={claim?.id ?? null}
        matchLabel={claim ? `${claim.teamA} vs ${claim.teamB} · ${claim.divisionName}` : ""}
      />
    </div>
  );
}
