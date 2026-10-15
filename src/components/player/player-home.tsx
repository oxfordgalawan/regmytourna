import Link from "next/link";
import { ArrowRight, Compass, MapPin, Sparkles, Swords, Ticket, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/player/countdown";
import { EntryTicket, paymentState } from "@/components/player/entry-ticket";
import { PayNowButton } from "@/components/player/pay-now-button";
import { PartnerInvitesCard } from "@/components/player/partner-invites-card";
import type { PartnerInvite } from "@/lib/registrations/partner-invites";
import { TournamentCard, type TournamentCardData } from "@/components/tournaments/tournament-card";
import { Reveal } from "@/components/motion/reveal";
import { formatDateRange, formatPhp } from "@/lib/format";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { isUpcoming, type PlayerEntry } from "@/lib/player/entries";
import { cn } from "@/lib/utils";

function greeting() {
  const h = Number(new Date().toLocaleString("en-PH", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The hero: the very next event, with a countdown and what to do next. */
function NextUp({ entry: e }: { entry: PlayerEntry }) {
  const pay = paymentState(e);
  const canPayOnline = e.paymentStatus !== "paid" && e.entrySource === "online" && e.feeCents > 0;
  const match = e.liveMatch ?? e.nextMatch;

  return (
    <section className="grain relative overflow-hidden rounded-3xl border border-umber bg-espresso">
      {e.tournament.coverImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.tournament.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-espresso via-espresso/90 to-espresso/40" />
        </>
      )}
      <div className="court-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-brass">
            {e.liveMatch ? (
              <>
                <span className="size-2 animate-pulse-dot rounded-full bg-rust" /> You&apos;re on court now
              </>
            ) : (
              "Next up"
            )}
          </p>
          <h2 className="display mt-3 text-4xl text-bone text-balance sm:text-5xl">{e.tournament.name}</h2>
          <p className="mt-2 text-bone/80">{e.categoryName}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span>{formatDateRange(e.tournament.startDate, e.tournament.endDate)}</span>
            {(e.tournament.venueName || e.tournament.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {[e.tournament.venueName, e.tournament.city].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          {match && (
            <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm backdrop-blur">
              <Swords className="size-4 shrink-0 text-brass" />
              <span className="truncate text-bone">
                {match.label} · vs <span className="font-medium">{match.opponent}</span>
              </span>
              {match.courtName && <span className="shrink-0 font-mono text-xs text-brass">{match.courtName}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:items-end">
          {e.tournament.startDate && !e.liveMatch && <Countdown date={e.tournament.startDate} />}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs",
                pay.tone === "good" ? "border-umber bg-umber/50 text-bone" : "border-brass/40 bg-brass/10 text-brass"
              )}
            >
              {pay.label}
            </span>
            {canPayOnline ? (
              <PayNowButton registrationId={e.id} label={`Pay ${formatPhp(e.feeCents)}`} />
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/tournaments/${e.tournament.slug}${e.tournament.status === "in_progress" ? "#draw" : ""}`} transitionTypes={NAV_FORWARD}>
                  {e.tournament.status === "in_progress" ? "Live draw" : "Event details"}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Ticket; value: number | string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-umber/40 text-brass">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="display text-3xl leading-none text-bone tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function PlayerHome({
  firstName,
  entries,
  openTournaments,
  invites = [],
}: {
  firstName: string;
  entries: PlayerEntry[];
  openTournaments: TournamentCardData[];
  invites?: PartnerInvite[];
}) {
  const upcoming = entries.filter(isUpcoming);
  const next = upcoming.find((e) => e.liveMatch) ?? upcoming[0];
  const others = upcoming.filter((e) => e.id !== next?.id);
  const wins = entries.reduce((n, e) => n + e.wins, 0);
  const matchesPlayed = entries.reduce((n, e) => n + e.played.length, 0);
  const enteredIds = new Set(entries.map((e) => e.tournament.id));
  const suggestions = openTournaments.filter((t) => !enteredIds.has(t.id)).slice(0, 6);

  return (
    <div className="space-y-10">
      <header className="animate-rise">
        <p className="eyebrow">{greeting()}</p>
        <h1 className="display mt-2 text-5xl text-bone sm:text-6xl">{firstName}</h1>
      </header>

      <PartnerInvitesCard invites={invites} />

      {next ? (
        <Reveal>
          <NextUp entry={next} />
        </Reveal>
      ) : (
        <Reveal>
          <section className="grain relative overflow-hidden rounded-3xl border border-umber bg-espresso p-6 sm:p-10">
            <div className="court-grid pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative max-w-xl">
              <Sparkles className="size-6 text-brass" />
              <h2 className="display mt-4 text-4xl text-bone sm:text-5xl">Your next tournament is out there.</h2>
              <p className="mt-3 text-bone/70">
                Pick a category, add your partner and pay online or at the venue. It takes about two minutes.
              </p>
              <Button size="lg" className="mt-6" asChild>
                <Link href="/explore" transitionTypes={NAV_FORWARD}>
                  <Compass />
                  Find a tournament
                </Link>
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={Ticket} value={upcoming.length} label="Upcoming" />
        <Stat icon={Swords} value={matchesPlayed} label="Matches played" />
        <Stat icon={Trophy} value={wins} label="Wins" />
      </div>

      {others.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-bone">Also coming up</h2>
            <Link href="/entries" className="text-sm text-muted-foreground hover:text-bone">
              All entries
            </Link>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {others.slice(0, 4).map((e, i) => (
              <Reveal key={e.id} delay={i * 70}>
                <EntryTicket entry={e} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-bone">Open for registration</h2>
            <Link href="/explore" className="text-sm text-muted-foreground hover:text-bone">
              See all
            </Link>
          </div>
          {/* swipe on phones, grid on larger screens */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
            {suggestions.map((t) => (
              <div key={t.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
                <TournamentCard tournament={t} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
