import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { getUmpireSession } from "@/lib/auth/umpire";
import { CourtScoringWidget } from "@/components/scoring/court-scoring-widget";
import type { Match } from "@/types/database";

export const metadata = { title: "Score match", robots: { index: false } };

export default async function UmpireMatchPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>;
}) {
  const { tournamentId, matchId } = await params;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(tournamentId) || !uuid.test(matchId)) notFound();

  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!match) notFound();

  const user = await getOptionalUser();
  const organizer = user ? await isOrganizerForTournament(user.id, tournamentId) : false;
  const session = await getUmpireSession(tournamentId);

  if (!organizer) {
    if (!session || match.assigned_umpire_id !== session.id) {
      redirect(`/umpire/${tournamentId}`);
    }
  }

  const [{ data: division }, { data: court }] = await Promise.all([
    match.division_id
      ? admin.from("tournament_divisions").select("name").eq("id", match.division_id).maybeSingle()
      : Promise.resolve({ data: null }),
    match.court_id
      ? admin.from("courts").select("name").eq("id", match.court_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main id="main" className="min-h-dvh bg-background">
      <CourtScoringWidget
        courtName={(court as { name?: string } | null)?.name ?? "Any court"}
        match={match as Match}
        divisionName={(division as { name?: string } | null)?.name}
        backHref={`/umpire/${tournamentId}`}
      />
    </main>
  );
}
