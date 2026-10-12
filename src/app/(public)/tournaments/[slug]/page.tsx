import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  LogIn,
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
import { relationOne } from "@/lib/supabase/relations";
import { daysUntil, formatDateRange, formatDateTime, formatPhp } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getTournamentBySlug(slug);
  return { title: data?.name ?? "Tournament" };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: tournament, error } = await getTournamentBySlug(slug);
  if (error || !tournament) notFound();

  const user = await getOptionalUser();
  const organizer = relationOne(tournament.profiles) as { full_name: string } | null;
  const divisions = (tournament.tournament_divisions ?? []) as Array<{
    id: string;
    name: string;
    format: string;
    entry_fee_cents: number | null;
    capacity: number | null;
  }>;

  const isOpen = tournament.status === "registration_open";
  const fees = divisions.map((d) => d.entry_fee_cents ?? tournament.entry_fee_cents);
  const minFee = fees.length ? Math.min(...fees) : tournament.entry_fee_cents;
  const maxFee = fees.length ? Math.max(...fees) : tournament.entry_fee_cents;
  const feeLabel =
    minFee === maxFee
      ? formatPhp(minFee, tournament.currency)
      : `${formatPhp(minFee, tournament.currency)} – ${formatPhp(maxFee, tournament.currency)}`;
  const countdown = daysUntil(tournament.start_date);
  const loginHref = `/login?next=${encodeURIComponent(`/tournaments/${slug}#register`)}`;

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
      value: formatDateTime(tournament.registration_closes_at) ?? "See division details",
      hint: null,
    },
    {
      icon: UserRound,
      label: "Organizer",
      value: organizer?.full_name ?? "RegMyTourna organizer",
      hint: null,
    },
  ];

  return (
    <div className="pb-28 lg:pb-24">
      {/* Header band */}
      <section className="grain relative overflow-hidden border-b border-line">
        <div className="court-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:pb-16">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
          >
            <ArrowLeft className="size-4" />
            All tournaments
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <StatusBadge status={tournament.status} />
            <span className="eyebrow">{tournament.sport}</span>
            {tournament.is_demo && <span className="eyebrow text-brass">Demo data</span>}
          </div>
          <h1 className="display mt-5 max-w-5xl text-[clamp(2.75rem,7vw,6rem)] text-bone text-balance">
            {tournament.name}
          </h1>
          {tournament.description && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/70">
              {tournament.description}
            </p>
          )}
        </div>
      </section>

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

          <section aria-labelledby="divisions-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="divisions-heading" className="display text-4xl text-bone">
                Divisions
              </h2>
              <span className="font-mono text-sm text-muted-foreground">
                {divisions.length} {divisions.length === 1 ? "division" : "divisions"}
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
                            {d.capacity} slots
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="font-mono text-bone">
                      {formatPhp(d.entry_fee_cents ?? tournament.entry_fee_cents, tournament.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted-foreground">
                Divisions haven&apos;t been announced yet.
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
                    {tournament.status === "published"
                      ? "Registration hasn't opened yet. Check back closer to the date."
                      : "Registration is closed for this tournament."}
                  </p>
                </div>
              ) : user ? (
                <RegisterSection
                  slug={slug}
                  currency={tournament.currency}
                  defaultFeeCents={tournament.entry_fee_cents}
                  divisions={divisions}
                />
              ) : (
                <div>
                  <p className="text-sm leading-relaxed text-bone/75">
                    Log in or create a free account to pick a division and pay. It takes about a
                    minute.
                  </p>
                  <div className="mt-5 grid gap-2">
                    <Button size="lg" asChild>
                      <Link href={loginHref}>
                        <LogIn />
                        Log in to register
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="/signup">Create an account</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Entry from</p>
              <p className="font-mono text-bone">{formatPhp(minFee, tournament.currency)}</p>
            </div>
            <Button size="lg" asChild>
              <Link href={user ? "#register" : loginHref}>Register now</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
