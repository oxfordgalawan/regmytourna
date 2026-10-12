"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChallongeService } from "@/lib/services/challonge/challonge-service";

export async function incrementScoreAction(
  matchId: string,
  side: "a" | "b"
) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");

  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, match.tournament_id))) {
    throw new Error("Unauthorized");
  }

  const field = side === "a" ? "score_a" : "score_b";
  const newScore = (match[field] as number) + 1;

  await admin
    .from("matches")
    .update({ [field]: newScore, status: "in_progress", started_at: match.started_at ?? new Date().toISOString() })
    .eq("id", matchId);

  await admin.from("match_scores").insert({
    match_id: matchId,
    game_number: match.current_game,
    score_a: side === "a" ? newScore : match.score_a,
    score_b: side === "b" ? newScore : match.score_b,
    action_type: `increment_${side}`,
    operator_id: user.id,
  });

  revalidatePath(`/court/${match.court_id ?? matchId}`);
  return { ok: true };
}

export async function undoLastScoreAction(matchId: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, match.tournament_id))) {
    throw new Error("Unauthorized");
  }

  const { data: events } = await admin
    .from("match_scores")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = events?.[0];
  if (!last) return { ok: false };

  await admin.from("match_scores").delete().eq("id", last.id);
  await admin
    .from("matches")
    .update({
      score_a: last.action_type === "increment_a" ? Math.max(0, match.score_a - 1) : match.score_a,
      score_b: last.action_type === "increment_b" ? Math.max(0, match.score_b - 1) : match.score_b,
    })
    .eq("id", matchId);

  revalidatePath(`/court/${match.court_id ?? matchId}`);
  return { ok: true };
}

export async function finalizeMatchAction(matchId: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, match.tournament_id))) {
    throw new Error("Unauthorized");
  }
  if (match.challonge_result_submitted_at) {
    return { ok: true, alreadySubmitted: true };
  }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("challonge_tournament_id, owner_id, scoring_config")
    .eq("id", match.tournament_id)
    .single();

  let gamesWonA = match.games_won_a;
  let gamesWonB = match.games_won_b;
  if (match.score_a > match.score_b) gamesWonA += 1;
  else if (match.score_b > match.score_a) gamesWonB += 1;

  const config = (tournament?.scoring_config ?? {}) as { games_to_win?: number };
  const gamesToWin = config.games_to_win ?? 2;
  const isMatchComplete = gamesWonA >= gamesToWin || gamesWonB >= gamesToWin;

  await admin
    .from("matches")
    .update({
      games_won_a: gamesWonA,
      games_won_b: gamesWonB,
      score_a: 0,
      score_b: 0,
      current_game: match.current_game + 1,
      status: isMatchComplete ? "completed" : "in_progress",
      completed_at: isMatchComplete ? new Date().toISOString() : null,
    })
    .eq("id", matchId);

  if (
    isMatchComplete &&
    tournament?.challonge_tournament_id &&
    match.challonge_match_id &&
    !match.challonge_result_submitted_at
  ) {
    const service = await ChallongeService.forUser(tournament.owner_id);
    if (service) {
      const scoresCsv = `${gamesWonA}-${gamesWonB}`;
      try {
        await service.reportScore(
          tournament.challonge_tournament_id,
          match.challonge_match_id,
          scoresCsv,
          true
        );
        await admin
          .from("matches")
          .update({ challonge_result_submitted_at: new Date().toISOString() })
          .eq("id", matchId);
      } catch {
        // Local result kept; Challonge sync can retry
      }
    }
  }

  revalidatePath(`/court/${match.court_id ?? matchId}`);
  return { ok: true, complete: isMatchComplete };
}
