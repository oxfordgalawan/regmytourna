"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ListPlus, Loader2, Undo2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { queueMatchAction, unqueueMatchAction } from "@/app/actions/queue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CourtSummary = { id: string; name: string; live: boolean; queued: number };

/** Pick a court for a match: shows who's playing and how long each court's line is. */
export function QueueDialog({
  tournamentId,
  match,
  courts,
  currentCourtId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  match: { id: string; teamA: string; teamB: string; divisionName: string };
  courts: CourtSummary[];
  currentCourtId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const loading = pending || busy !== null;

  function pick(courtId: string) {
    if (loading) return;
    setBusy(courtId);
    startTransition(async () => {
      const res = await queueMatchAction(tournamentId, match.id, courtId);
      setBusy(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const c = courts.find((x) => x.id === courtId);
      toast.success(`Queued on ${c?.name ?? "court"}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    if (loading) return;
    setBusy("remove");
    startTransition(async () => {
      const res = await unqueueMatchAction(tournamentId, match.id);
      setBusy(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Removed from the queue");
      onOpenChange(false);
      router.refresh();
    });
  }

  // fewest waiting first is usually the right pick
  const shortest = courts.length ? Math.min(...courts.map((c) => c.queued + (c.live ? 1 : 0))) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-xl md:max-w-2xl">
        <div className="border-b border-line px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-lg text-bone">
            {currentCourtId ? "Move to another court" : "Add to queue"}
          </DialogTitle>
          <DialogDescription className="mt-1.5 line-clamp-3 text-pretty leading-snug">
            {match.teamA} vs {match.teamB} · {match.divisionName}
          </DialogDescription>
        </div>
        <div className="relative max-h-[min(65dvh,28rem)] space-y-2.5 overflow-y-auto px-6 py-5">
          {loading && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-espresso/60 pb-6 backdrop-blur-[1px]"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/90 px-4 py-2 text-sm text-bone shadow-lg">
                <Loader2 className="size-4 shrink-0 animate-spin text-brass" />
                {busy === "remove" ? "Removing from queue…" : "Adding to queue…"}
              </span>
            </div>
          )}
          {!courts.length ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
              <p className="text-sm text-bone">No courts yet</p>
              <Button size="sm" className="mt-3" asChild>
                <Link href={`/organizer/tournaments/${tournamentId}/courts`}>Add courts</Link>
              </Button>
            </div>
          ) : (
            courts.map((c) => {
              const here = c.id === currentCourtId;
              const load = c.queued + (c.live ? 1 : 0);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={loading || here}
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-5 py-3.5 text-left transition-all duration-200 ease-out",
                    here
                      ? "border-bone bg-bone/[0.06]"
                      : "border-line hover:-translate-y-0.5 hover:border-brass/45 hover:bg-bone/[0.05] hover:shadow-md active:translate-y-0 active:scale-[0.99]",
                    loading && "opacity-70",
                    (loading || here) && "disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  )}
                >
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", c.live ? "animate-pulse-dot bg-rust" : "bg-brass/70")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-bone">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.live ? "Playing now" : "Free"} · {c.queued} in line
                      {!here && load === shortest && <span className="ml-1.5 text-brass">· shortest wait</span>}
                    </span>
                  </span>
                  {busy === c.id ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : here ? (
                    <Check className="size-4 text-bone" />
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">#{c.queued + 1}</span>
                  )}
                </button>
              );
            })
          )}
          {currentCourtId && (
            <Button variant="ghost" className="mt-2 w-full" disabled={loading} onClick={remove}>
              {busy === "remove" ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Remove from queue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Add to queue" / "Court 2 · #3" button for a match row. */
export function QueueButton({
  tournamentId,
  match,
  courts,
  currentCourtId,
  position,
}: {
  tournamentId: string;
  match: { id: string; teamA: string; teamB: string; divisionName: string };
  courts: CourtSummary[];
  currentCourtId: string | null;
  position: number | null;
}) {
  const [open, setOpen] = useState(false);
  const court = courts.find((c) => c.id === currentCourtId);
  return (
    <>
      {court ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8">
          {court.name}
          <span className="font-mono text-[0.65rem] text-brass">{position === 1 ? "next" : position ? `#${position}` : ""}</span>
        </Button>
      ) : (
        <Button size="sm" variant="umber" onClick={() => setOpen(true)} className="h-8">
          <ListPlus />
          Add to queue
        </Button>
      )}
      <QueueDialog
        tournamentId={tournamentId}
        match={match}
        courts={courts}
        currentCourtId={currentCourtId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
