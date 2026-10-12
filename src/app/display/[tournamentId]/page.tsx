import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { cn } from "@/lib/utils";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-ink p-8 text-bone">
        Configure Supabase to load the TV display.
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("tournament_display_public")
    .select("*")
    .eq("tournament_id", tournamentId);

  const tournamentName = rows?.[0]?.tournament_name ?? "Tournament";
  const matches = (rows ?? [])
    .filter((r) => r.match_id)
    .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"));

  return (
    <div className="grain min-h-screen bg-ink text-bone">
      <header className="flex items-end justify-between gap-8 border-b border-umber px-10 py-8">
        <div>
          <p className="eyebrow flex items-center gap-2 text-bone/80">
            <span className="size-2 animate-pulse-dot rounded-full bg-rust" />
            Live courts
          </p>
          <h1 className="display mt-3 text-7xl">{tournamentName}</h1>
        </div>
        <AutoRefresh />
      </header>

      <main className="grid gap-5 p-10 md:grid-cols-2 2xl:grid-cols-3">
        {matches.length === 0 && (
          <p className="display col-span-full py-32 text-center text-5xl text-bone/40">
            Matches will appear here
          </p>
        )}
        {matches.map((m) => {
          const live = m.status === "in_progress";
          const a = Number(m.score_a ?? 0);
          const b = Number(m.score_b ?? 0);
          return (
            <article
              key={m.match_id as string}
              className={cn(
                "overflow-hidden rounded-3xl border",
                live ? "border-bone/40 bg-espresso" : "border-line bg-surface"
              )}
            >
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <p className="display text-3xl">{m.court_name ?? "Court TBA"}</p>
                <p className="text-right">
                  <span className="block font-mono text-xs tracking-widest text-brass uppercase">
                    {live ? "In play" : (m.status as string)}
                  </span>
                  <span className="block text-sm text-bone/60">
                    {m.division_name} · M{m.match_number ?? "—"}
                  </span>
                </p>
              </div>
              {[
                { label: m.team_a_label, score: a, lead: a > b },
                { label: m.team_b_label, score: b, lead: b > a },
              ].map((side, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-6 px-6 py-4",
                    i === 0 && "border-b border-line"
                  )}
                >
                  <span className={cn("truncate text-2xl font-medium", side.lead ? "text-bone" : "text-bone/60")}>
                    {side.label}
                  </span>
                  <span
                    className={cn(
                      "display text-7xl tabular-nums",
                      side.lead ? "text-bone" : "text-bone/45"
                    )}
                  >
                    {side.score}
                  </span>
                </div>
              ))}
            </article>
          );
        })}
      </main>
    </div>
  );
}
