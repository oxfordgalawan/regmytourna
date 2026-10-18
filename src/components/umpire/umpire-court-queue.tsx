"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Hand } from "lucide-react";
import { ClaimMatchDialog } from "@/components/umpire/claim-match-dialog";
import { StartMatchButton } from "@/components/umpire/start-match-button";
import { Button } from "@/components/ui/button";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import type { QueueData, QueueMatch } from "@/lib/queue/load";
import { cn } from "@/lib/utils";

/**
 * The umpire's view of the event queue: every court with what's on it now and
 * what's next, plus matches not on a court yet. Unassigned matches can be
 * claimed with a PIN; your own matches open the scoresheet.
 */
export function UmpireCourtQueue({
  tournamentId,
  data,
  meId,
}: {
  tournamentId: string;
  data: QueueData;
  meId: string | null;
}) {
  const [claim, setClaim] = useState<QueueMatch | null>(null);
  const [showAllReady, setShowAllReady] = useState(false);
  const ready = [...data.liveElsewhere, ...data.ready];
  const readyShown = showAllReady ? ready : ready.slice(0, 6);

  const action = (m: QueueMatch) => (
    <UmpireMatchAction tournamentId={tournamentId} m={m} meId={meId} onClaim={setClaim} />
  );

  return (
    <div className="space-y-8">
      {data.courts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted-foreground">
          The organizer hasn&apos;t set up courts yet — matches waiting to be played are listed below.
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.courts.map((c) => {
            const live = c.live[0] ?? null;
            return (
              <section
                key={c.id}
                className={cn("min-w-0 overflow-hidden rounded-2xl border bg-surface", live ? "border-rust/40" : "border-line")}
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <h2 className="display truncate text-2xl text-bone">{c.name}</h2>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs",
                      live ? "bg-rust/15 text-[#e58a72]" : "bg-brass/10 text-brass"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", live ? "animate-pulse-dot bg-rust" : "bg-brass")} />
                    {live ? "Playing" : "Free"}
                  </span>
                </header>

                {live && (
                  <div className="border-b border-line bg-espresso/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Score name={live.teamA} score={live.scoreA} lead={live.scoreA > live.scoreB} />
                        <Score name={live.teamB} score={live.scoreB} lead={live.scoreB > live.scoreA} />
                      </div>
                      {action(live)}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {live.divisionName}
                      {live.umpireName ? ` · ${live.umpireName}` : ""}
                    </p>
                  </div>
                )}

                {c.queued.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">{live ? "Nothing queued after this." : "Nothing queued."}</p>
                ) : (
                  <ol className="divide-y divide-line">
                    {c.queued.map((m, i) => (
                      <li key={m.id} className={cn("flex items-center gap-3 px-4 py-3", i === 0 && "bg-brass/[0.06]")}>
                        <span className={cn("w-10 shrink-0 font-mono text-[0.7rem]", i === 0 ? "text-brass" : "text-muted-foreground")}>
                          {i === 0 ? "NEXT" : `#${i + 1}`}
                        </span>
                        <MatchText m={m} meId={meId} />
                        {action(m)}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}

      {ready.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-bone">Not in a court queue yet</h2>
            <span className="font-mono text-xs text-muted-foreground">{ready.length}</span>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readyShown.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <MatchText m={m} meId={meId} />
                {action(m)}
              </li>
            ))}
          </ul>
          {ready.length > readyShown.length && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllReady(true)}>
              <ChevronDown />
              Show all {ready.length}
            </Button>
          )}
        </section>
      )}

      <ClaimMatchDialog
        open={Boolean(claim)}
        onOpenChange={(o) => !o && setClaim(null)}
        tournamentId={tournamentId}
        signedIn={Boolean(meId)}
        matchId={claim?.id ?? null}
        matchLabel={claim ? `${claim.teamA} vs ${claim.teamB} · ${claim.divisionName}` : ""}
      />
    </div>
  );
}

function Score({ name, score, lead }: { name: string; score: number; lead: boolean }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className={cn("truncate text-sm", lead ? "text-bone" : "text-bone/65")}>{name}</span>
      <span className={cn("display text-2xl tabular-nums", lead ? "text-bone" : "text-bone/50")}>{score}</span>
    </p>
  );
}

function MatchText({ m, meId }: { m: QueueMatch; meId: string | null }) {
  const mine = Boolean(meId && m.umpireId === meId);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm text-bone">{m.teamA}</p>
      <p className="truncate text-sm text-bone">
        <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">vs</span>
        {m.teamB}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {m.divisionName}
        {m.status === "in_progress" && " · live"}
        {m.umpireName && (
          <span className={mine ? "text-brass" : undefined}> · {mine ? "You" : m.umpireName}</span>
        )}
      </p>
    </div>
  );
}

/** Claim / Start match / Continue, depending on who holds the match. */
export function UmpireMatchAction({
  tournamentId,
  m,
  meId,
  onClaim,
}: {
  tournamentId: string;
  m: QueueMatch;
  meId: string | null;
  onClaim: (m: QueueMatch) => void;
}) {
  if (meId && m.umpireId === meId) {
    if (m.status === "scheduled") return <StartMatchButton tournamentId={tournamentId} matchId={m.id} />;
    return (
      <Button size="sm" asChild className="h-9 shrink-0">
        <Link href={`/umpire/${tournamentId}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
          Continue
          <ChevronRight />
        </Link>
      </Button>
    );
  }
  if (!m.umpireId && m.status === "scheduled") {
    return (
      <Button size="sm" variant="umber" className="h-9 shrink-0" onClick={() => onClaim(m)}>
        <Hand />
        Grab
      </Button>
    );
  }
  return null;
}
