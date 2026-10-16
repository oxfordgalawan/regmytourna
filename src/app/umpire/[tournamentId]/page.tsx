import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUmpireSession } from "@/lib/auth/umpire";
import { UmpireHub } from "@/components/umpire/umpire-hub";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { loadQueue } from "@/lib/queue/load";
import { loadDivisionContext } from "@/lib/draw/server";
import { buildDrawView } from "@/lib/draw/view";

export const metadata = { title: "Umpire hub", robots: { index: false } };

export default async function UmpireBoardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) notFound();

  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) notFound();

  const [session, queue, { data: divisions }] = await Promise.all([
    getUmpireSession(tournamentId),
    // same court queue the organizer manages: courts in order, then matches not on a court yet
    loadQueue(tournamentId),
    admin.from("tournament_divisions").select("id, name, bracket_state").eq("tournament_id", tournamentId).order("sort_order"),
  ]);

  const startedIds = (divisions ?? [])
    .filter((d) => d.bracket_state && d.bracket_state !== "not_started")
    .map((d) => d.id);
  const bracketCategories = (
    await Promise.all(
      startedIds.map(async (divisionId) => {
        const ctx = await loadDivisionContext(divisionId);
        const div = divisions?.find((d) => d.id === divisionId);
        return ctx && div ? { id: divisionId, name: div.name as string, view: buildDrawView(ctx) } : null;
      })
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <main id="main" className="min-h-dvh bg-background">
      <AutoRefresh seconds={20} clock={false} />
      <UmpireHub
        tournamentId={tournamentId}
        tournamentName={tournament.name}
        sessionUmpire={session}
        queue={queue}
        bracketCategories={bracketCategories}
      />
    </main>
  );
}
