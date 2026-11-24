import Link from "next/link";
import { NAV_BACK } from "@/lib/nav-transitions";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  ScrollText,
  UserRound,
  Users,
} from "lucide-react";
import { getTournamentBySlug } from "@/lib/tournaments/queries";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";
import { RegisterSection } from "@/components/tournaments/register-section";
import { TournamentRegisterGuestAuth } from "@/components/tournaments/tournament-register-guest-auth";
import { RegisterFeeProvider } from "@/components/tournaments/register-fee-context";
import { TournamentMobileRegisterBar } from "@/components/tournaments/tournament-mobile-register-bar";
import { DivisionRosterButton } from "@/components/tournaments/division-roster-button";
import { TournamentCoverHero } from "@/components/tournaments/tournament-cover-hero";
import { relationOne } from "@/lib/supabase/relations";
import { modeOf } from "@/lib/tournaments/mode";
import { slotCounts } from "@/lib/registrations/waitlist";
import { entrantNoun } from "@/lib/categories";
import { describeFormat, parseBracketConfig } from "@/lib/bracket-format";
import { loadDivisionContext } from "@/lib/draw/server";
import { buildDrawView } from "@/lib/draw/view";
import { PublicDraw } from "@/components/draw/public-draw";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { daysUntil, formatDateRange, formatDateTime, formatPhp } from "@/lib/format";
import { isRegistrationWindowOpen, registrationWindowOpensAt } from "@/lib/tournaments/registration-window";
import { buildTournamentPageMetadata } from "@/lib/tournaments/share-metadata";

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getTournamentBySlug(slug);
  if (!data) return { title: "Tournament" };
  return buildTournamentPageMetadata(
    {
      name: data.name,
      slug: data.slug,
      description: data.description,
      cover_image_url: data.cover_image_url,
      currency: data.currency,
      entry_fee_cents: data.entry_fee_cents,
      start_date: data.start_date,
      end_date: data.end_date,
      venue_name: data.venue_name,
      city: data.city,
      venue_address: data.venue_address,
      status: data.status,
      registration_opens_at: data.registration_opens_at,
      registration_closes_at: data.registration_closes_at,
      tournament_divisions: (data.tournament_divisions ?? []) as Array<{ entry_fee_cents: number | null }>,
    },
    metadataBase
  );
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: tournament } = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const user = await getOptionalUser();
  const organizer = relationOne(tournament.profiles) as { full_name: string } | null;
  const divisions = (tournament.tournament_divisions ?? []) as Array<{
    id: string;
    name: string;
    format: string;
    entry_fee_cents: number | null;
    capacity: number | null;
    bracket_config: unknown;
    bracket_state?: string | null;
  }>;

  const counts = await slotCounts(tournament.id);
  const waitlistOn = Boolean(tournament.waitlist_enabled);

  // live draws for categories that have started
  const startedIds = divisions.filter((d) => d.bracket_state && d.bracket_state !== "not_started").map((d) => d.id);
  const draws = (
    await Promise.all(
      startedIds.map(async (divisionId) => {
        const ctx = await loadDivisionContext(divisionId);
        return ctx ? { id: divisionId, name: ctx.division.name, view: buildDrawView(ctx) } : null;
      })
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  // bracket-only: the organizer entered the players — no registration or fees here
  const bracketOnly = modeOf(tournament as Record<string, unknown>) === "bracket_only";
  const schedule = {
    status: tournament.status,
    registration_opens_at: tournament.registration_opens_at,
    registration_closes_at: tournament.registration_closes_at,
  };
  const isOpen = !bracketOnly && isRegistrationWindowOpen(schedule);
  const opensLater = !isOpen ? registrationWindowOpensAt(schedule) : null;
  const fees = divisions.map((d) => d.entry_fee_cents ?? tournament.entry_fee_cents);
  const minFee = fees.length ? Math.min(...fees) : tournament.entry_fee_cents;
  const maxFee = fees.length ? Math.max(...fees) : tournament.entry_fee_cents;
  const feeLabel =
    minFee === maxFee
      ? formatPhp(minFee, tournament.currency)
      : `${formatPhp(minFee, tournament.currency)} – ${formatPhp(maxFee, tournament.currency)}`;
  const defaultSelectedFee =
    divisions[0]?.entry_fee_cents ?? tournament.entry_fee_cents;
  const syncMobileFee = isOpen && !bracketOnly;
  const countdown = daysUntil(tournament.start_date);
  const showBracketSoon =
    draws.length === 0 &&
    (tournament.status === "in_progress" || tournament.status === "registration_closed");

  const facts = [
    {
      icon: CalendarDays,
      label: "Dates",
      value: formatDateRange(tournament.start_date, tournament.end_date),
      hint: countdown,
    },
    {
      icon: MapPin,
      label: "Venue",
      value: tournament.venue_name ?? "To be announced",
      hint: [tournament.venue_address, tournament.city].filter(Boolean).join(", ") || null,
    },
    {
      icon: Clock,
      label: "Entries close",
      value: formatDateTime(tournament.registration_closes_at) ?? "See category details",
      hint: null,
    },
    {
      icon: UserRound,
      label: "Organizer",
      value: organizer?.full_name ?? "RegMyTourna organizer",
      hint: null,
    },
  ];

  const page = (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-24">
      <TournamentCoverHero coverUrl={tournament.cover_image_url} tournamentName={tournament.name}>
        <div className="pointer-events-none mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-10 pb-16 sm:px-6 sm:pb-20 lg:pb-24 lg:pt-14 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <Link
            transitionTypes={NAV_BACK}
            href="/tournaments"
            className="relative z-10 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
          >
            <ArrowLeft className="size-4" />
            All tournaments
          </Link>
          <div className="pointer-events-none relative z-10 mt-auto pt-10 sm:pt-14 [&_a]:pointer-events-auto">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={tournament.status} />
              <span className="eyebrow">{tournament.sport}</span>
              {tournament.is_demo && <span className="eyebrow text-brass">Demo data</span>}
            </div>
            <h1 className="display mt-6 max-w-5xl text-[clamp(3rem,8vw,6.75rem)] leading-[0.95] text-bone text-balance sm:mt-7">
              {tournament.name}
            </h1>
            {tournament.description && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/75 sm:text-xl sm:leading-relaxed">
                {tournament.description}
              </p>
            )}
            {draws.length > 0 && (
              <Link
                href="#draw"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-bone underline decoration-umber underline-offset-4 hover:decoration-brass"
              >
                View brackets
              </Link>
            )}
          </div>
        </div>
      </TournamentCoverHero>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_24rem]">
        {/* Main column */}
        <div className="space-y-10">
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-4 bg-surface p-5">
                <f.icon className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
                <div className="min-w-0">
                  <dt className="eyebrow">{f.label}</dt>
                  <dd className="mt-1.5 font-medium text-bone">{f.value}</dd>
                  {f.hint && <dd className="mt-0.5 text-sm text-muted-foreground">{f.hint}</dd>}
                </div>
              </div>
            ))}
          </dl>

          <section id="entries" className="scroll-mt-24" aria-labelledby="divisions-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="divisions-heading" className="display text-4xl text-bone">
                Categories
              </h2>
              <span className="font-mono text-sm text-muted-foreground">
                {divisions.length} {divisions.length === 1 ? "category" : "categories"}
              </span>
            </div>
            {divisions.length ? (
              <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {divisions.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-surface px-5 py-4 transition-colors hover:bg-espresso/60"
                  >
                    <div>
                      <p className="font-medium text-bone">{d.name}</p>
                      <p className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">{d.format}</span>
                        {d.capacity && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" aria-hidden />
                            {counts[d.id]?.taken ?? 0}/{d.capacity} {entrantNoun(d.format, d.capacity)}
                          </span>
                        )}
                        {d.capacity && (counts[d.id]?.taken ?? 0) >= d.capacity && (
                          <span className="rounded-full border border-brass/40 px-2 py-0.5 text-[0.7rem] text-brass">
                            {waitlistOn ? "Full · waitlist open" : "Full"}
                          </span>
                        )}
                      </p>
                      {(() => {
                        const info = describeFormat(
                          parseBracketConfig(d.bracket_config, d.capacity ?? 16),
                          d.capacity ?? 16
                        );
                        return (
                          <p className="mt-1 font-mono text-[0.7rem] text-brass">
                            {info.name} · {info.guaranteed}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <DivisionRosterButton
                        tournamentSlug={slug}
                        tournamentId={tournament.id}
                        divisionId={d.id}
                        format={d.format}
                        registrationOpen={isOpen}
                        isSignedIn={Boolean(user)}
                        waitlistEnabled={waitlistOn}
                        entryFeeCents={d.entry_fee_cents}
                        defaultFeeCents={tournament.entry_fee_cents}
                        currency={tournament.currency}
                        allowPayAtVenue={Boolean(tournament.allow_walk_in_payment)}
                        capacity={d.capacity}
                        taken={counts[d.id]?.taken ?? 0}
                      />
                      {!bracketOnly && (
                        <span className="font-mono text-bone">
                          {formatPhp(d.entry_fee_cents ?? tournament.entry_fee_cents, tournament.currency)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted-foreground">
                Categories haven&apos;t been announced yet.
              </p>
            )}
            {showBracketSoon && (
              <p className="mt-4 text-sm text-muted-foreground">
                Brackets will appear on this page once the organizer starts each category.
              </p>
            )}
          </section>

          {tournament.rules && (
            <section aria-labelledby="rules-heading">
              <h2 id="rules-heading" className="display flex items-center gap-3 text-4xl text-bone">
                Rules & eligibility
              </h2>
              <div className="mt-5 flex gap-4 rounded-2xl border border-line bg-surface p-6">
                <ScrollText className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-bone/75">
                  {tournament.rules}
                </p>
              </div>
            </section>
          )}

          {tournament.challonge_url && (
            <a
              href={tournament.challonge_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-umber bg-umber/20 p-6 transition-colors hover:bg-umber/35"
            >
              <div>
                <p className="eyebrow text-brass">Bracket & results</p>
                <p className="mt-1.5 text-lg font-medium text-bone">Follow the draw on Challonge</p>
              </div>
              <ExternalLink className="size-5 text-bone transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          )}
        </div>

        {/* Sticky sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start" id="register">
          {bracketOnly ? (
            <div className="grain relative overflow-hidden rounded-2xl border border-umber bg-espresso p-6">
              <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
              <div className="relative">
                <p className="eyebrow">Players</p>
                <p className="display mt-2 text-5xl text-bone">
                  {Object.values(counts).reduce((n, c) => n + c.taken, 0)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {divisions.length} {divisions.length === 1 ? "category" : "categories"} · entered by the organizer
                </p>
                <p className="mt-5 text-sm leading-relaxed text-bone/75">
                  Players for this event were entered by the organizer, so there&apos;s no sign-up here. Open a
                  category&apos;s entries to see who&apos;s playing, and follow the bracket and live scores below.
                </p>
                {draws.length > 0 && (
                  <Button className="mt-5 w-full" asChild>
                    <Link href="#draw">Live bracket &amp; scores</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
          <div className="overflow-hidden rounded-2xl border border-umber bg-espresso">
            <div className="border-b border-line p-6">
              <p className="eyebrow">Entry fee</p>
              <p className="display mt-2 text-5xl text-bone">{feeLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">per entry, paid online</p>
            </div>

            <div className="p-6">
              {!isOpen ? (
                <div className="text-sm text-muted-foreground">
                  <StatusBadge status={tournament.status} />
                  <p className="mt-3">
                    {opensLater
                      ? `Registration opens ${formatDateTime(tournament.registration_opens_at)} (Philippine time).`
                      : tournament.status === "published"
                        ? "Set a registration open date and time, or open registration from organizer controls."
                        : "Registration is closed for this tournament."}
                  </p>
                </div>
              ) : user ? (
                <RegisterSection
                  slug={slug}
                  currency={tournament.currency}
                  defaultFeeCents={tournament.entry_fee_cents}
                  allowPayAtVenue={Boolean(tournament.allow_walk_in_payment)}
                  waitlistEnabled={waitlistOn}
                  divisions={divisions.map((d) => ({ ...d, taken: counts[d.id]?.taken ?? 0 }))}
                />
              ) : (
                <TournamentRegisterGuestAuth variant="sidebar" />
              )}
            </div>
          </div>
          )}
        </aside>
      </div>

      {draws.length > 0 && (
        <section id="draw" className="mx-auto mt-16 max-w-7xl scroll-mt-24 px-4 sm:px-6" aria-labelledby="draw-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 id="draw-heading" className="display text-4xl text-bone">
              Draw & results
            </h2>
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-rust" />
              Updates live
            </span>
          </div>
          <AutoRefresh seconds={30} clock={false} />
          <PublicDraw tournamentId={tournament.id} categories={draws} />
        </section>
      )}

      {syncMobileFee && <TournamentMobileRegisterBar isSignedIn={Boolean(user)} />}
    </div>
  );

  if (!syncMobileFee) return page;

  return (
    <RegisterFeeProvider initialFeeCents={defaultSelectedFee} currency={tournament.currency}>
      {page}
    </RegisterFeeProvider>
  );
}
