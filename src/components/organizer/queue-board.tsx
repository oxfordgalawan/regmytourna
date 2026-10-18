"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowRightLeft, ArrowUp, LayoutGrid, ListPlus, MoreHorizontal, Undo2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { moveInQueueAction, unqueueMatchAction } from "@/app/actions/queue";
import { assignMatchUmpireAction } from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueueDialog, type CourtSummary } from "@/components/organizer/queue-dialog";
import type { QueueData, QueueMatch } from "@/lib/queue/load";
import { cn } from "@/lib/utils";

/**
 * The event-wide queue: matches ready to play on the left, each court's
 * live match and line on the right. One queue for every category.
 */
export function QueueBoard({ tournamentId, data }: { tournamentId: string; data: QueueData }) {
  const [category, setCategory] = useState<string>("all");
  const [queueing, setQueueing] = useState<QueueMatch | null>(null);

  const summaries: CourtSummary[] = data.courts.map((c) => ({
    id: c.id,
    name: c.name,
    live: c.live.length > 0,
    queued: c.queued.length,
  }));
  const ready = useMemo(
    () => data.ready.filter((m) => category === "all" || m.divisionId === category),
    [data.ready, category]
  );
  const readyCategories = data.categories.filter((c) => data.ready.some((m) => m.divisionId === c.id));

  if (!data.courts.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
          <LayoutGrid className="size-5" />
        </span>
        <p className="mt-4 font-semibold text-bone">Add your courts first</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The queue lines up matches per court. Add Court 1, Court 2… and come back here.
        </p>
        <Button className="mt-5" asChild>
          <Link href={`/organizer/tournaments/${tournamentId}/courts`}>Go to Courts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Ready to play */}
      <section className="min-w-0 space-y-3 xl:sticky xl:top-24 xl:self-start">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-bone">Ready to play</h2>
          <span className="font-mono text-xs text-muted-foreground">{data.ready.length} waiting</span>
        </div>
        {readyCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "all", name: "All" }, ...readyCategories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "max-w-[12rem] truncate rounded-full border px-3 py-1 text-xs transition-colors",
                  category === c.id ? "border-bone bg-bone text-ink" : "border-line text-muted-foreground hover:text-bone"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {!ready.length ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted-foreground">
            {data.ready.length ? "Nothing waiting in this category." : "Every ready match is queued or playing."}
          </p>
        ) : (
          <ul className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
            {ready.map((m) => (
              <li key={m.id} className="min-w-0 rounded-xl border border-line bg-surface p-3">
                <MatchLines m={m} />
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{m.umpireName ?? "No umpire yet"}</span>
                  <Button size="sm" variant="umber" className="h-8 shrink-0" onClick={() => setQueueing(m)}>
                    <ListPlus />
                    Queue
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.liveElsewhere.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {data.liveElsewhere.length} live {data.liveElsewhere.length === 1 ? "match has" : "matches have"} no court
            — assign one from the Matches tab.
          </p>
        )}
      </section>

      {/* Courts */}
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data.courts.map((c) => (
          <CourtCard
            key={c.id}
            tournamentId={tournamentId}
            court={c}
            umpires={data.umpires}
            onMove={(m) => setQueueing(m)}
          />
        ))}
      </section>

      {queueing && (
        <QueueDialog
          key={queueing.id}
          tournamentId={tournamentId}
          match={queueing}
          courts={summaries}
          currentCourtId={queueing.courtId && summaries.some((s) => s.id === queueing.courtId) ? queueing.courtId : null}
          open
          onOpenChange={(o) => !o && setQueueing(null)}
        />
      )}
    </div>
  );
}

function MatchLines({ m }: { m: QueueMatch }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-bone">{m.teamA}</p>
      <p className="truncate text-sm text-bone">
        <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">vs</span>
        {m.teamB}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {m.divisionName}
        {m.label && <span className="font-mono"> · {m.label}</span>}
      </p>
    </div>
  );
}

function CourtCard({
  tournamentId,
  court,
  umpires,
  onMove,
}: {
  tournamentId: string;
  court: QueueData["courts"][number];
  umpires: QueueData["umpires"];
  onMove: (m: QueueMatch) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const live = court.live[0] ?? null;

  function run(fn: () => Promise<{ error?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else if (ok) toast.success(ok);
      router.refresh();
    });
  }

  return (
    <article className={cn("flex min-w-0 flex-col rounded-2xl border bg-surface", live ? "border-rust/40" : "border-line")}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="display text-2xl text-bone">{court.name}</h3>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs",
            live ? "bg-rust/15 text-[#e58a72]" : "bg-brass/10 text-brass"
          )}
        >
          <span className={cn("size-1.5 rounded-full", live ? "animate-pulse-dot bg-rust" : "bg-brass")} />
          {live ? "Playing" : "Free"}
        </span>
      </header>

      <div className="border-b border-line px-4 py-3">
        <p className="eyebrow mb-2">On court</p>
        {live ? (
          <div>
            <MatchLines m={live} />
            <p className="mt-1 text-xs text-brass">{live.umpireName ? `Umpire: ${live.umpireName}` : "No umpire"}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {court.queued.length ? "Free — the next match can start." : "Free — queue a match."}
          </p>
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        <p className="eyebrow mb-2">Queued · {court.queued.length}</p>
        {!court.queued.length ? (
          <p className="text-sm text-muted-foreground">Nothing in line.</p>
        ) : (
          <ol className="space-y-2">
            {court.queued.map((m, i) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-xl border p-3",
                  i === 0 ? "border-brass/50 bg-brass/[0.06]" : "border-line bg-ink/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("w-9 shrink-0 font-mono text-xs", i === 0 ? "text-brass" : "text-muted-foreground")}>
                    {i === 0 ? "NEXT" : `#${i + 1}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <MatchLines m={m} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button size="icon-sm" variant="ghost" aria-label="Queue options" disabled={pending}>
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {i > 0 && (
                        <DropdownMenuItem onClick={() => run(() => moveInQueueAction(tournamentId, m.id, "up"))}>
                          <ArrowUp />
                          Move up
                        </DropdownMenuItem>
                      )}
                      {i < court.queued.length - 1 && (
                        <DropdownMenuItem onClick={() => run(() => moveInQueueAction(tournamentId, m.id, "down"))}>
                          <ArrowDown />
                          Move down
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onMove(m)}>
                        <ArrowRightLeft />
                        Move to another court
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => run(() => unqueueMatchAction(tournamentId, m.id), "Back in Ready to play")}
                      >
                        <Undo2 />
                        Remove from queue
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-2 pl-12">
                  <Select
                    value={m.umpireId ?? "none"}
                    items={[{ value: "none", label: "Unassigned — umpires can claim" }, ...umpires.map((u) => ({ value: u.id, label: u.name }))]}
                    onValueChange={(v) => {
                      if (!v) return;
                      run(() => assignMatchUmpireAction(tournamentId, m.id, v === "none" ? null : v));
                    }}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="Umpire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned — umpires can claim</SelectItem>
                      {umpires.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
