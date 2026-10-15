"use server";

import { revalidatePath } from "next/cache";
import { requireMatchScoringAccess } from "@/lib/auth/umpire";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceAfterResult } from "@/lib/draw/progress";

type MatchRow = {
  id: string;
  tournament_id: string;
  court_id: string | null;
};

function revalidateScoring(match: MatchRow) {
  revalidatePath(`/court/${match.court_id ?? match.id}`);
  revalidatePath(`/umpire/${match.tournament_id}`);
  revalidatePath(`/umpire/${match.tournament_id}/match/${match.id}`);
}

export async function incrementScoreAction(matchId: string, side: "a" | "b") {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");
  const actor = await requireMatchScoringAccess(match.tournament_id, matchId);
  if (["completed", "walkover", "cancelled"].includes(match.status)) {
    throw new Error("This match is already finished");
  }
  if (match.stage && (!match.team_a_registration_id || !match.team_b_registration_id)) {
    throw new Error("Waiting for both teams to be decided");
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
    operator_id: actor.operatorId,
    operator_label: actor.operatorLabel,
  });

  revalidateScoring(match);
  return { ok: true };
}

export async function undoLastScoreAction(matchId: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");
  await requireMatchScoringAccess(match.tournament_id, matchId);

  // only points in the game being played can be undone; finished games are on record
  const { data: events } = await admin
    .from("match_scores")
    .select("*")
    .eq("match_id", matchId)
    .eq("game_number", match.current_game)
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

  revalidateScoring(match);
  return { ok: true };
}

/** Final score of every game, from the point log plus the game just ended. */
async function gameScores(matchId: string, currentGame: number, current: { a: number; b: number }) {
  const { data: events } = await createAdminClient()
    .from("match_scores")
    .select("game_number, score_a, score_b, created_at")
    .eq("match_id", matchId)
    .lt("game_number", currentGame)
    .order("created_at", { ascending: true });
  const byGame = new Map<number, { a: number; b: number }>();
  for (const e of events ?? []) byGame.set(e.game_number, { a: e.score_a, b: e.score_b });
  byGame.set(currentGame, current);
  return [...byGame.entries()].sort(([x], [y]) => x - y).map(([, s]) => s);
}

export async function finalizeMatchAction(matchId: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");
  await requireMatchScoringAccess(match.tournament_id, matchId);
  if (match.status === "completed") {
    return { ok: true, complete: true };
  }
  if (match.score_a === match.score_b) {
    return { ok: false, error: "A game can't end on a tied score." };
  }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("scoring_config")
    .eq("id", match.tournament_id)
    .single();

  const gamesWonA = match.games_won_a + (match.score_a > match.score_b ? 1 : 0);
  const gamesWonB = match.games_won_b + (match.score_b > match.score_a ? 1 : 0);

  const config = (tournament?.scoring_config ?? {}) as { games_to_win?: number };
  const gamesToWin = config.games_to_win ?? 2;
  const isMatchComplete = gamesWonA >= gamesToWin || gamesWonB >= gamesToWin;
  const games = await gameScores(matchId, match.current_game, { a: match.score_a, b: match.score_b });

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
      game_scores: games.map((g) => [g.a, g.b]),
    })
    .eq("id", matchId);

  if (isMatchComplete) {
    // moves the winner (and loser, in double knockout) into their next matches
    await advanceAfterResult(
      matchId,
      gamesWonA > gamesWonB ? "a" : "b",
      games.map((g) => [g.a, g.b] as [number, number])
    );
  }

  revalidateScoring(match);
  return { ok: true, complete: isMatchComplete };
}
