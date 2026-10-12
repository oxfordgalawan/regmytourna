import Link from "next/link";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function ScoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: courts } = await supabase
    .from("courts")
    .select("id, name")
    .eq("tournament_id", id)
    .order("sort_order");

  const { data: activeMatches } = await supabase
    .from("matches")
    .select("id, team_a_label, team_b_label, court_id, status")
    .eq("tournament_id", id)
    .in("status", ["scheduled", "in_progress"])
    .limit(10);

  return (
    <div className="space-y-10">
      <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
        <p className="text-sm leading-relaxed text-bone/75">
          Open a court on the referee&apos;s phone or tablet. Scores save instantly and appear on
          the TV display. Scoring rules come from the tournament settings.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-bone">Courts</h2>
        {courts?.length ? (
          <div className="flex flex-wrap gap-2">
            {courts.map((c) => (
              <Link
                key={c.id}
                href={`/court/${c.id}`}
                className="group inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-bone transition-colors hover:border-umber hover:bg-espresso"
              >
                <span className="display text-2xl">{c.name}</span>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-bone" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No courts yet —{" "}
            <Link href={`/organizer/tournaments/${id}/courts`} className="text-bone underline underline-offset-4">
              add one
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-bone">Up next & in play</h2>
        {activeMatches?.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {activeMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/court/${m.court_id ?? m.id}`}
                  className="group flex items-center gap-4 bg-surface px-5 py-4 transition-colors hover:bg-espresso/60"
                >
                  <span className="min-w-0 flex-1 truncate text-bone">
                    {m.team_a_label}
                    <span className="mx-2 font-mono text-xs text-muted-foreground">vs</span>
                    {m.team_b_label}
                  </span>
                  <StatusBadge status={m.status} />
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground group-hover:text-bone">
                    Score
                    <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted-foreground">
            No scheduled or live matches right now.
          </p>
        )}
      </section>
    </div>
  );
}
