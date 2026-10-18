"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, GitBranch, ListChecks, ListOrdered, LogIn, LogOut, UserRound } from "lucide-react";
import { umpireSignInAction, umpireSignOutAction } from "@/app/actions/umpire";
import { UmpireCourtQueue } from "@/components/umpire/umpire-court-queue";
import { UmpireMatches } from "@/components/umpire/umpire-matches";
import { UmpireBrackets } from "@/components/umpire/umpire-brackets";
import { PinEntry } from "@/components/umpire/pin-entry";
import { StartMatchButton } from "@/components/umpire/start-match-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DrawView } from "@/lib/draw/view";
import type { QueueData, QueueMatch } from "@/lib/queue/load";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";

type Tab = "queue" | "matches" | "mine" | "brackets";

export function UmpireHub({
  tournamentId,
  tournamentName,
  sessionUmpire,
  queue,
  finishedMatches,
  bracketCategories,
}: {
  tournamentId: string;
  tournamentName: string;
  sessionUmpire: { id: string; name: string } | null;
  queue: QueueData;
  finishedMatches: QueueMatch[];
  bracketCategories: Array<{ id: string; name: string; view: DrawView }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("queue");
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);

  const all: QueueMatch[] = [
    ...queue.courts.flatMap((c) => [...c.live, ...c.queued]),
    ...queue.liveElsewhere,
    ...queue.ready,
  ];
  const mineActive = sessionUmpire
    ? all
        .filter((m) => m.umpireId === sessionUmpire.id)
        .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"))
    : [];
  const mineDone = finishedMatches;
  const courtName = new Map(queue.courts.map((c) => [c.id, c.name]));

  const tabs: Array<{ key: Tab; label: string; icon: typeof ListOrdered; count?: number }> = [
    { key: "queue", label: "Queue", icon: ListOrdered },
    { key: "matches", label: "Matches", icon: ListChecks },
    ...(sessionUmpire
      ? [{ key: "mine" as const, label: "My matches", icon: UserRound, count: mineActive.length + mineDone.length }]
      : []),
    { key: "brackets", label: "Brackets", icon: GitBranch },
  ];

  return (
    <div className="w-full px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-12 lg:px-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Umpire hub</p>
          <h1 className="display mt-1.5 truncate text-3xl text-bone sm:text-5xl">{tournamentName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {sessionUmpire ? (
              <>
                Signed in as <span className="text-bone">{sessionUmpire.name}</span>
              </>
            ) : (
              "Anyone can view. Your PIN is needed to grab or score."
            )}
          </p>
        </div>
        {sessionUmpire ? (
          <button
            type="button"
            onClick={async () => {
              await umpireSignOutAction(tournamentId);
              router.refresh();
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs text-muted-foreground hover:text-bone"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        ) : (
          <Button size="sm" className="shrink-0" onClick={() => setSignInOpen(true)}>
            <LogIn />
            Sign in
          </Button>
        )}
      </header>

      {/* tabs: a bottom nav on phones (thumb-reachable), a sticky pill bar on larger screens */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:sticky sm:top-0 sm:bottom-auto sm:-mx-6 sm:mt-5 sm:border-t-0 sm:border-b sm:bg-ink/90 sm:px-6 sm:py-2 lg:-mx-10 lg:px-10"
        aria-label="Umpire hub"
      >
        <div className="grid grid-flow-col auto-cols-fr sm:flex sm:w-fit sm:gap-1 sm:rounded-full sm:border sm:border-line sm:bg-surface sm:p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors",
                "sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm",
                tab === t.key ? "text-bone sm:bg-bone sm:text-ink" : "text-muted-foreground hover:text-bone"
              )}
            >
              {/* active marker on the phone bar */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-0.5 w-10 rounded-full bg-bone transition-opacity sm:hidden",
                  tab === t.key ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="relative">
                <t.icon className="size-5 sm:size-4" />
                {t.count ? (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-3 rounded-full px-1.5 font-mono text-[0.6rem] leading-4 sm:static sm:ml-1",
                      tab === t.key ? "bg-brass text-ink sm:bg-ink/15 sm:text-ink" : "bg-umber text-bone"
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div key={tab} className="mt-6 animate-rise">
        {tab === "queue" && <UmpireCourtQueue tournamentId={tournamentId} data={queue} meId={sessionUmpire?.id ?? null} />}

        {tab === "matches" && <UmpireMatches tournamentId={tournamentId} data={queue} meId={sessionUmpire?.id ?? null} />}

        {tab === "mine" &&
          (mineActive.length === 0 && mineDone.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <p className="font-semibold text-bone">No matches yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Grab one from the Queue tab.</p>
              <Button className="mt-4" variant="outline" onClick={() => setTab("queue")}>
                Open the queue
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {mineActive.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-bone">Up next</h2>
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {mineActive.map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          "flex min-w-0 items-center gap-3 rounded-2xl border bg-surface p-4",
                          m.status === "in_progress" ? "border-rust/40" : "border-line"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted-foreground">
                            {[m.courtId ? courtName.get(m.courtId) : null, m.divisionName, m.status === "in_progress" ? "Live" : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-bone">{m.teamA}</p>
                          <p className="truncate text-sm font-medium text-bone">
                            <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">vs</span>
                            {m.teamB}
                          </p>
                        </div>
                        {m.status === "scheduled" ? (
                          <StartMatchButton tournamentId={tournamentId} matchId={m.id} className="h-10" />
                        ) : (
                          <Button size="sm" className="h-10 shrink-0" asChild>
                            <Link href={`/umpire/${tournamentId}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
                              Continue
                              <ChevronRight />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {mineDone.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-bone">Finished</h2>
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {mineDone.map((m) => (
                      <li
                        key={m.id}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 opacity-95"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted-foreground">
                            {[m.divisionName, m.label, m.status === "walkover" ? "Walkover" : "Done"].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-bone">{m.teamA}</p>
                          <p className="truncate text-sm font-medium text-bone">
                            <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">vs</span>
                            {m.teamB}
                          </p>
                          <p className="mt-1 font-mono text-xs text-brass">
                            Games {m.gamesA}–{m.gamesB}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="h-10 shrink-0" asChild>
                          <Link href={`/umpire/${tournamentId}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
                            View
                            <ChevronRight />
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ))}

        {tab === "brackets" && <UmpireBrackets tournamentId={tournamentId} categories={bracketCategories} />}
      </div>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>Use the PIN the organizer gave you.</DialogDescription>
          </DialogHeader>
          <PinEntry
            busy={signInBusy}
            label="Your 4-digit PIN"
            onSubmit={async (pin) => {
              setSignInBusy(true);
              const res = await umpireSignInAction(tournamentId, pin);
              setSignInBusy(false);
              if (res.error) return { error: res.error };
              setSignInOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
