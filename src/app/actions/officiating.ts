"use server";

import { revalidatePath } from "next/cache";
import { requireMatchScoringAccess } from "@/lib/auth/umpire";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TIMERS,
  initialServe,
  isServeState,
  rally,
  timerLabel,
  type MatchSetup,
  type ServeState,
  type Side,
} from "@/lib/scoring/pickleball";

type Result<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

const MIGRATION_HINT = "Officiating isn't set up yet — apply the match_officiating database migration.";

function dbError(message: string) {
  return /match_events|match_setup|serve_state|prev_state/.test(message) ? MIGRATION_HINT : message;
}

async function loadForOfficiating(matchId: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return { error: "Match not found." } as const;
  try {
    const actor = await requireMatchScoringAccess(match.tournament_id, matchId);
    return { admin, match, actor } as const;
  } catch {
    return { error: "Only the umpire on this match can do that." } as const;
  }
}

function refresh(match: { id: string; tournament_id: string; court_id: string | null }) {
  revalidatePath(`/umpire/${match.tournament_id}`);
  revalidatePath(`/umpire/${match.tournament_id}/match/${match.id}`);
  revalidatePath(`/court/${match.court_id ?? match.id}`);
  revalidatePath(`/display/${match.tournament_id}`);
}

/** Every timer start / finish / stop is logged — proof of what the umpire ran. */
export async function logTimerAction(
  matchId: string,
  event: "started" | "finished" | "stopped",
  seconds: number,
  elapsedSeconds?: number
): Promise<Result> {
  if (!TIMERS.some((t) => t.seconds === seconds)) return { error: "Unknown timer." };
  const ctx = await loadForOfficiating(matchId);
  if ("error" in ctx) return { error: ctx.error! };
  const { admin, match, actor } = ctx;
  const { error } = await admin.from("match_events").insert({
    match_id: matchId,
    tournament_id: match.tournament_id,
    kind: `timer_${event}`,
    payload: {
      seconds,
      label: timerLabel(seconds),
      game: match.current_game,
      ...(elapsedSeconds != null ? { elapsed: Math.max(0, Math.round(elapsedSeconds)) } : {}),
    },
    operator_id: actor.operatorId,
    operator_label: actor.operatorLabel,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath(`/umpire/${match.tournament_id}/match/${matchId}`);
  return { ok: true };
}

/** Records the toss and base players, then puts the game in play at 0-0-2. */
export async function startGameAction(
  matchId: string,
  input: { tossWinner: Side; firstServe: Side; base: { a: number; b: number } }
): Promise<Result<{ state: ServeState }>> {
  const ctx = await loadForOfficiating(matchId);
  if ("error" in ctx) return { error: ctx.error! };
  const { admin, match, actor } = ctx;
  if (match.status === "scheduled") {
    // started straight from the scoreboard: put it on court first
    await admin
      .from("matches")
      .update({ status: "in_progress", started_at: match.started_at ?? new Date().toISOString() })
      .eq("id", matchId);
  } else if (match.status !== "in_progress") {
    return { error: "This match is already finished." };
  }
  const sides = ["a", "b"] as const;
  if (!sides.includes(input.tossWinner) || !sides.includes(input.firstServe)) return { error: "Pick the toss winner and first server." };
  const base = { a: input.base.a === 1 ? 1 : 0, b: input.base.b === 1 ? 1 : 0 };

  const { data: division } = match.division_id
    ? await admin.from("tournament_divisions").select("format").eq("id", match.division_id).maybeSingle()
    : { data: null };
  const doubles = (division?.format ?? "doubles") !== "singles";

  const prevSetup = (match as { match_setup?: MatchSetup | null }).match_setup ?? null;
  const setup: MatchSetup = {
    tossWinner: prevSetup?.tossWinner ?? input.tossWinner,
    firstServe: input.firstServe,
    base,
    game1Serve: prevSetup?.game1Serve ?? input.firstServe,
  };
  const state = initialServe(match.current_game, doubles, input.firstServe, base);

  const { error } = await admin.from("matches").update({ match_setup: setup, serve_state: state }).eq("id", matchId);
  if (error) return { error: dbError(error.message) };

  await admin.from("match_events").insert({
    match_id: matchId,
    tournament_id: match.tournament_id,
    kind: "game_started",
    payload: {
      game: match.current_game,
      tossWinner: setup.tossWinner,
      firstServe: input.firstServe,
      base,
      teams: { a: match.team_a_label, b: match.team_b_label },
    },
    operator_id: actor.operatorId,
    operator_label: actor.operatorLabel,
  });

  refresh(match);
  return { ok: true, state };
}

/** One rally: point to the servers, or a fault (second server / side out). */
export async function rallyAction(matchId: string, winner: Side): Promise<Result<{ state: ServeState; score: { a: number; b: number } }>> {
  const ctx = await loadForOfficiating(matchId);
  if ("error" in ctx) return { error: ctx.error! };
  const { admin, match, actor } = ctx;
  if (match.status !== "in_progress") return { error: "This match isn't in play." };
  const current = (match as { serve_state?: unknown }).serve_state;
  if (!isServeState(current) || current.game !== match.current_game) return { error: "Start the game first." };

  const before = { a: match.score_a as number, b: match.score_b as number };
  const next = rally(current, before, winner);

  // optimistic lock: only apply if nobody scored in between
  const { data: updated, error } = await admin
    .from("matches")
    .update({ score_a: next.scores.a, score_b: next.scores.b, serve_state: next.state })
    .eq("id", matchId)
    .eq("score_a", before.a)
    .eq("score_b", before.b)
    .select("id")
    .maybeSingle();
  if (error) return { error: dbError(error.message) };
  if (!updated) return { error: "The score just changed on another device — refreshing." };

  await admin.from("match_scores").insert({
    match_id: matchId,
    game_number: match.current_game,
    score_a: next.scores.a,
    score_b: next.scores.b,
    action_type: next.kind === "point" ? `increment_${current.serving}` : next.kind,
    operator_id: actor.operatorId,
    operator_label: actor.operatorLabel,
    prev_state: { score_a: before.a, score_b: before.b, serve_state: current },
  });

  refresh(match);
  return { ok: true, state: next.state, score: next.scores };
}
