import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Circle } from "lucide-react";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { createClient } from "@/lib/supabase/server";
import { describeFormat, parseBracketConfig } from "@/lib/bracket-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatTile } from "@/components/layout/page-header";
import { formatDateRange, formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAppUrl } from "@/lib/env/server";
import { RegistrationQrCard } from "@/components/tournaments/registration-qr-card";
import { PublishChecklistAction } from "@/components/organizer/tournament-status-controls";
import { getRegistrationMode } from "@/lib/tournaments/mode";

const DRAW_STATE: Record<string, string> = {
  not_started: "Seeding",
  pools: "Pools in play",
  pools_done: "Pools finished",
  final: "In play",
  complete: "Complete",
};

export default async function OrganizerTournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();

  if (!t) return null;

  const bracketOnly = (await getRegistrationMode(id)) === "bracket_only";

  const [{ data: divisions }, { data: regs }, { count: courtCount }] = await Promise.all([
    supabase
      .from("tournament_divisions")
      .select("id, name, capacity, bracket_config, bracket_state")
      .eq("tournament_id", id)
      .order("sort_order"),
    supabase.from("registrations").select("id, payment_status, status, division_id").eq("tournament_id", id),
    supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", id),
  ]);
  const divisionCount = divisions?.length ?? 0;
  const { count: umpireCount } = await createAdminClient()
    .from("tournament_umpires")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", id)
    .eq("active", true);
  const started = (divisions ?? []).filter((d) => d.bracket_state && d.bracket_state !== "not_started");

  const total = regs?.length ?? 0;
  const paid = (regs ?? []).filter((r) => r.payment_status === "paid").length;

  const checklist = [
    { done: divisionCount > 0, label: "Add categories", href: `/organizer/tournaments/${id}/divisions` },
    {
      done: divisionCount > 0 && (divisions ?? []).every((d) => d.bracket_config),
      label: "Choose each category's format",
      href: `/organizer/tournaments/${id}/divisions`,
    },
    { done: t.status !== "draft", label: "Publish the event", href: null },
    { done: total > 0, label: "Take your first entry", href: `/tournaments/${t.slug}` },
    {
      done: divisionCount > 0 && started.length === divisionCount,
      label: "Seed & start brackets",
      href: `/organizer/tournaments/${id}/draw`,
    },
    {
      done: (umpireCount ?? 0) > 0,
      label: "Add umpires to the roster",
      href: `/organizer/tournaments/${id}/umpires`,
    },
    { done: (courtCount ?? 0) > 0, label: "Set up courts for scoring", href: `/organizer/tournaments/${id}/courts` },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-10">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Entries" value={total} hint={`${paid} paid · ${total - paid} not yet`} />
        <StatTile label="Categories" value={divisionCount} />
        <StatTile label="Courts" value={courtCount ?? 0} />
        <StatTile
          label="Entry fee"
          value={formatPhp(t.entry_fee_cents, t.currency)}
          hint={formatDateRange(t.start_date, t.end_date)}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-bone">Setup checklist</h2>
            <span className="font-mono text-sm text-muted-foreground">
              {doneCount}/{checklist.length}
            </span>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-bone transition-all duration-700"
              style={{ width: `${(doneCount / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="mt-5 space-y-1">
            {checklist.map((item) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      item.done ? "bg-bone text-ink" : "text-muted-foreground"
                    )}
                  >
                    {item.done ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-4" />}
                  </span>
                  <span className={cn("flex-1", item.done && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                  {!item.done && item.href && <ArrowRight className="size-4 text-muted-foreground" />}
                </>
              );
              const isPublish = item.label === "Publish the event";
              return (
                <li key={item.label}>
                  {!item.done && item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-bone transition-colors hover:bg-espresso"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-2 py-2.5 text-sm text-bone">
                      <div className="flex items-center gap-3">{content}</div>
                      {isPublish && !item.done && (
                        <PublishChecklistAction tournamentId={id} bracketOnly={bracketOnly} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <dl className="grid content-start gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {[
            { label: "Page address", value: `/tournaments/${t.slug}`, mono: true },
            { label: "Sport", value: t.sport },
            { label: "Venue", value: t.venue_name ?? "—" },
            { label: "City", value: t.city ?? "—" },
            { label: "Listing", value: t.is_public ? "Public" : "Unlisted" },
            { label: "Waitlist", value: t.waitlist_enabled ? "On" : "Off" },
          ].map((row) => (
            <div key={row.label} className="bg-surface px-5 py-4">
              <dt className="eyebrow">{row.label}</dt>
              <dd className={cn("mt-1.5 truncate text-bone capitalize", row.mono && "font-mono text-sm normal-case")}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <RegistrationQrCard
          registrationUrl={`${getAppUrl()}/tournaments/${t.slug}#register`}
          tournamentName={t.name}
          slug={t.slug}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="font-semibold text-bone">Brackets</h2>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted-foreground">
              {started.length}/{divisionCount} started
            </span>
            <Link
              href={`/organizer/tournaments/${id}/draw`}
              transitionTypes={NAV_FORWARD}
              className="text-sm text-bone underline decoration-umber underline-offset-4 hover:decoration-brass"
            >
              View all categories
            </Link>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {(divisions ?? []).map((d) => (
            <li key={d.id}>
              <Link
                href={`/organizer/tournaments/${id}/draw/${d.id}`}
                transitionTypes={NAV_FORWARD}
                className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-espresso/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-bone">{d.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {describeFormat(parseBracketConfig(d.bracket_config, d.capacity ?? 16), d.capacity ?? 16).name}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {DRAW_STATE[d.bracket_state ?? "not_started"] ?? "Seeding"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
