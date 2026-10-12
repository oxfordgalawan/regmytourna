import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChallongeLinkPanel } from "@/components/organizer/challonge-link-panel";
import { StatTile } from "@/components/layout/page-header";
import { formatDateRange, formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function OrganizerTournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();

  if (!t) return null;

  const [{ count: divisionCount }, { data: regs }, { count: courtCount }] = await Promise.all([
    supabase
      .from("tournament_divisions")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", id),
    supabase.from("registrations").select("id, payment_status").eq("tournament_id", id),
    supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", id),
  ]);

  const total = regs?.length ?? 0;
  const paid = (regs ?? []).filter((r) => r.payment_status === "paid").length;

  const checklist = [
    { done: (divisionCount ?? 0) > 0, label: "Add divisions", href: `/organizer/tournaments/${id}/divisions` },
    { done: t.status !== "draft", label: "Publish the event", href: null },
    { done: total > 0, label: "Take your first entry", href: `/tournaments/${t.slug}` },
    { done: Boolean(t.challonge_tournament_id), label: "Link a Challonge bracket", href: "#challonge" },
    { done: (courtCount ?? 0) > 0, label: "Set up courts for scoring", href: `/organizer/tournaments/${id}/courts` },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-10">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Entries" value={total} hint={`${paid} paid · ${total - paid} not yet`} />
        <StatTile label="Divisions" value={divisionCount ?? 0} />
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
                    <div className="flex items-center gap-3 px-2 py-2.5 text-sm text-bone">{content}</div>
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

      <div id="challonge" className="scroll-mt-24">
        <ChallongeLinkPanel
          tournamentId={id}
          linkedId={t.challonge_tournament_id}
          linkedUrl={t.challonge_url}
          syncStatus={t.challonge_sync_status}
        />
      </div>
    </div>
  );
}
