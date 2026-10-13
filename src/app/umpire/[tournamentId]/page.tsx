import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScoringActor } from "@/lib/auth/umpire";
import { PinPad } from "@/components/umpire/pin-pad";
import { MatchBoard, type BoardMatch } from "@/components/umpire/match-board";
import { AutoRefresh } from "@/components/display/auto-refresh";

export const metadata = { title: "Umpire scoring", robots: { index: false } };

export default async function UmpireBoardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) notFound();

  // umpires have no Supabase session, so reads go through the server after the check below
  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) notFound();

  const actor = await getScoringActor(tournamentId);
  if (!actor) {
    return (
      <main id="main" className="min-h-dvh bg-background">
        <PinPad tournamentId={tournamentId} tournamentName={tournament.name} />
      </main>
    );
  }

  const [{ data: divisions }, { data: courts }, { data: matches }] = await Promise.all([
    admin.from("tournament_divisions").select("id, name").eq("tournament_id", tournamentId).order("sort_order"),
    admin.from("courts").select("id, name").eq("tournament_id", tournamentId),
    admin
      .from("matches")
      .select(
        "id, status, stage, is_bye, is_conditional, team_a_registration_id, team_b_registration_id, team_a_label, team_b_label, score_a, score_b, games_won_a, games_won_b, division_id, court_id, round_label, match_number"
      )
      .eq("tournament_id", tournamentId)
      .in("status", ["scheduled", "in_progress", "completed", "walkover"])
      .order("match_number", { ascending: true, nullsFirst: false }),
  ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));
  const courtName = new Map((courts ?? []).map((c) => [c.id, c.name as string]));

  // hide byes and anything still waiting on a previous result
  const playable = (matches ?? []).filter(
    (m) =>
      !m.is_bye &&
      !(m.is_conditional && !m.team_a_registration_id) &&
      (!m.stage || m.status !== "scheduled" || (m.team_a_registration_id && m.team_b_registration_id))
  );
  const board: BoardMatch[] = playable.map((m) => ({
    id: m.id,
    status: m.status === "walkover" ? "completed" : m.status,
    teamA: m.team_a_label,
    teamB: m.team_b_label,
    scoreA: m.score_a,
    scoreB: m.score_b,
    gamesA: m.games_won_a,
    gamesB: m.games_won_b,
    divisionId: m.division_id,
    divisionName: m.division_id ? (divisionName.get(m.division_id) ?? null) : null,
    courtName: m.court_id ? (courtName.get(m.court_id) ?? null) : null,
    label: m.round_label ?? (m.match_number ? `Match ${m.match_number}` : "Match"),
  }));

  return (
    <main id="main" className="min-h-dvh bg-background">
      <AutoRefresh seconds={20} clock={false} />
      <MatchBoard
        tournamentId={tournamentId}
        tournamentName={tournament.name}
        divisions={(divisions ?? []).map((d) => ({ id: d.id, name: d.name }))}
        matches={board}
        isUmpire={actor.operatorLabel === "Umpire"}
      />
    </main>
  );
}
