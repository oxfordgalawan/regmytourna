"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Clock, FileText, List, Lock, LogIn, Search, Users } from "lucide-react";
import { getMyPetitionEligibilityAction } from "@/app/actions/petitions";
import { getPublicDivisionRosterAction } from "@/app/actions/public-roster";
import { PetitionSubmitDialog } from "@/components/petitions/petition-submit-dialog";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { entrantNoun } from "@/lib/categories";
import type { PublicRosterEntry } from "@/lib/registrations/public-roster";

type Eligibility = Awaited<ReturnType<typeof getMyPetitionEligibilityAction>>;
type Roster = Awaited<ReturnType<typeof getPublicDivisionRosterAction>>;

/** One entry as a card: stacked avatars, names, and their entry number. */
function TeamCard({ entry, index }: { entry: PublicRosterEntry; index: number }) {
  const [a, b] = entry.players;
  return (
    <li
      className="group relative flex animate-rise items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-umber"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <span className="absolute top-3 right-4 font-mono text-[0.65rem] tracking-widest text-muted-foreground/70">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex shrink-0 -space-x-3">
        <PlayerAvatar name={a.name} src={a.avatarUrl} className="size-12 text-base" />
        {b && (
          <PlayerAvatar
            name={b.name}
            src={b.avatarUrl}
            className="size-12 text-base transition-transform duration-300 group-hover:translate-x-1"
          />
        )}
      </div>
      <div className="min-w-0 pr-6">
        <p className="truncate font-semibold text-bone">{a.name}</p>
        {b && (
          <p className="truncate text-sm text-bone/75">
            <span className="text-brass">&amp;</span> {b.name}
          </p>
        )}
      </div>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex -space-x-3">
        <span className="size-12 animate-pulse rounded-full bg-umber/40 ring-2 ring-espresso" />
        <span className="size-12 animate-pulse rounded-full bg-umber/30 ring-2 ring-espresso" />
      </div>
      <div className="flex-1 space-y-2">
        <span className="block h-3.5 w-3/5 animate-pulse rounded bg-umber/40" />
        <span className="block h-3 w-2/5 animate-pulse rounded bg-umber/25" />
      </div>
    </li>
  );
}

export function DivisionRosterButton({
  tournamentSlug,
  tournamentId,
  divisionId,
  format,
}: {
  tournamentSlug: string;
  tournamentId: string;
  divisionId: string;
  format: string;
}) {
  const [open, setOpen] = useState(false);
  const [petitionOpen, setPetitionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Roster | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  async function load() {
    setLoading(true);
    setError(null);
    const [res, elig] = await Promise.all([
      getPublicDivisionRosterAction(tournamentSlug, divisionId),
      getMyPetitionEligibilityAction(tournamentSlug, divisionId),
    ]);
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
    }
    setEligibility("error" in elig && elig.error ? null : elig);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      void load();
    }
  }

  function refreshEligibility() {
    void getMyPetitionEligibilityAction(tournamentSlug, divisionId).then((elig) => {
      if (!("error" in elig && elig.error)) setEligibility(elig);
    });
  }

  const roster = data && !("error" in data) ? data : null;
  const elig = eligibility && !("error" in eligibility) ? eligibility : null;
  const noun = (n: number) => entrantNoun(format, n || 1);
  const matches = (e: PublicRosterEntry) => !q || e.players.some((p) => p.name.toLowerCase().includes(q));
  const slots = roster?.slots.filter(matches) ?? [];
  const fill = roster?.capacity ? Math.min(100, (roster.taken / roster.capacity) * 100) : null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <List className="size-4" />
        Entries
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-3xl">
          {/* header */}
          <div className="grain relative shrink-0 overflow-hidden border-b border-line px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
            <div className="court-grid pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative">
              <p className="eyebrow text-brass">Who&apos;s in</p>
              <DialogTitle className="display mt-2 pr-8 text-3xl text-bone sm:text-4xl">
                {roster?.divisionName ?? "Category entries"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {roster
                  ? roster.capacity
                    ? `${roster.taken} of ${roster.capacity} ${noun(roster.capacity)} · ${Math.max(0, roster.capacity - roster.taken)} spots left`
                    : `${roster.taken} ${noun(roster.taken)} entered`
                  : "Everyone who has entered this category."}
              </DialogDescription>
              {fill !== null && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/60" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-umber to-brass transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(fill, 2)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
            {error && <p className="text-sm text-[#e58a72]">{error}</p>}

            {loading && (
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Loading entries">
                {Array.from({ length: 4 }, (_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </ul>
            )}

            {roster && !loading && (
              <>
                {roster.slots.length > 6 && (
                  <label className="relative block">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <span className="sr-only">Find a player</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a player"
                      className="h-11 w-full rounded-xl border border-line bg-ink/40 pr-4 pl-10 text-sm text-bone outline-none placeholder:text-muted-foreground focus:border-umber"
                    />
                  </label>
                )}

                {roster.slots.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
                      <Users className="size-5" />
                    </span>
                    <p className="mt-4 font-semibold text-bone">No entries yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Be the first to sign up for this category.</p>
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No player matches &ldquo;{query}&rdquo;.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {slots.map((e, i) => (
                      <TeamCard key={`${e.players.map((p) => p.name).join("|")}-${i}`} entry={e} index={i} />
                    ))}
                  </ul>
                )}

                <section>
                  <h3 className="eyebrow flex items-center gap-2">
                    Waitlist
                    <span className="rounded-full border border-line px-1.5 font-mono text-[0.65rem] tracking-normal text-muted-foreground">
                      {roster.waitlist.length}
                    </span>
                  </h3>
                  {roster.waitlist.length === 0 ? (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4">
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <p className="text-sm text-muted-foreground">
                        No one is waiting. If this category fills up, new teams line up here and only pay once a slot
                        opens.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {roster.waitlist.map((e, i) => (
                        <li key={`wl-${i}`} className="flex items-center gap-3 bg-surface/60 px-4 py-3">
                          <span className="w-7 font-mono text-xs text-brass">#{e.waitlistPosition ?? i + 1}</span>
                          <div className="flex -space-x-2">
                            {e.players.map((p) => (
                              <PlayerAvatar key={p.name} name={p.name} src={p.avatarUrl} className="size-8 text-xs" />
                            ))}
                          </div>
                          <span className="min-w-0 truncate text-sm text-bone/85">
                            {e.players.map((p) => p.name).join(" & ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>

          {/* petitions: visible to everyone, only usable by teams entered in this category */}
          {roster && !loading && (
            <div className="shrink-0 border-t border-line bg-ink/40 px-5 py-4 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-bone">Entry petition</p>
                  <p className="text-muted-foreground">
                    {!elig || elig.reason === "not_signed_in"
                      ? "Entered in this category? Log in to file a petition."
                      : elig.reason === "invite_pending"
                        ? "You were added as a partner here. Accept your invite first."
                        : elig.reason === "not_registered"
                          ? "Only players registered in this category can file a petition."
                          : elig.reason === "pending_exists"
                            ? "Your petition is under review."
                            : elig.existingPetition?.status === "rejected" && elig.existingPetition.reviewerNote
                              ? elig.existingPetition.reviewerNote
                              : "Need a change to your entry? Ask the organizer."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {elig?.existingPetition && <StatusBadge status={elig.existingPetition.status} />}
                  {!elig || elig.reason === "not_signed_in" ? (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/login?next=${encodeURIComponent(`/tournaments/${tournamentSlug}#entries`)}`}>
                        <LogIn className="size-4" />
                        Log in
                      </Link>
                    </Button>
                  ) : elig.reason === "invite_pending" && elig.inviteToken ? (
                    <Button size="sm" asChild>
                      <Link href={`/invite/${elig.inviteToken}`}>Open invite</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!(elig.eligible && elig.registrationId && elig.entryName)}
                      onClick={() => setPetitionOpen(true)}
                      title={elig.eligible ? undefined : "Only players registered in this category can petition"}
                    >
                      {elig.eligible ? <FileText className="size-4" /> : <Lock className="size-4" />}
                      Apply petition
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {elig?.eligible && elig.registrationId && elig.entryName && (
        <PetitionSubmitDialog
          open={petitionOpen}
          onOpenChange={setPetitionOpen}
          tournamentId={tournamentId}
          registrationId={elig.registrationId}
          entryName={elig.entryName}
          onSubmitted={refreshEligibility}
        />
      )}
    </>
  );
}
