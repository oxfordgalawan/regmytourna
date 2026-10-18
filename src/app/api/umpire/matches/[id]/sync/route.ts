import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMatchScoringAccess } from "@/lib/auth/umpire";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceAfterResult } from "@/lib/draw/progress";
import { timerLabel } from "@/lib/scoring/pickleball";
import type { CoreSnapshot, Op } from "@/lib/scoring/match-engine";

const MAX_OPS = 200;
const UUID = /^[0-9a-f-]{36}$/i;

function fail(error: string, code: string, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

const isDup = (e: { code?: string } | null) => e?.code === "23505";

function validSnapshot(s: CoreSnapshot | undefined): s is CoreSnapshot {
  if (!s) return false;
  const ints = [s.game, s.scoreA, s.scoreB, s.gamesA, s.gamesB, s.seq];
  return ints.every((n) => Number.isInteger(n) && n >= 0 && n < 10_000) && (s.status === "in_progress" || s.status === "completed");
}

/**
 * Receives an umpire device's queued ops (in order) and records them. Ops at
 * or below matches.client_seq were already applied, so retries are no-ops.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  if (!UUID.test(matchId)) return fail("Match not found.", "not_found", 404);

  let ops: Op[];
  try {
    const body = (await request.json()) as { ops?: Op[] };
    ops = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS) : [];
  } catch {
    return fail("Bad request.", "bad_request");
  }

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail("Match not found.", "not_found", 404);

  let actor;
  try {
    actor = await requireMatchScoringAccess(match.tournament_id, matchId);
  } catch {
    return fail("Sign in again to sync this match.", "auth", 401);
  }

  const applied = Number((match as { client_seq?: number }).client_seq ?? 0);
  const fresh = ops.filter((o) => Number.isInteger(o.seq) && o.seq > applied).sort((x, y) => x.seq - y.seq);
  if (!fresh.length) return NextResponse.json({ syncedSeq: applied });
  if (fresh[0].seq !== applied + 1) {
    // a gap means ops from another device or a lost batch — don't guess
    return fail("This match was changed from another device.", "stale", 409);
  }
  if (match.status === "completed" || match.status === "walkover" || match.status === "cancelled") {
    return fail("This match is already finished on the server.", "finished", 409);
  }

  const who = { operator_id: actor.operatorId, operator_label: actor.operatorLabel };
  let last: CoreSnapshot | null = null;
  let completed: { winner: "a" | "b"; games: Array<[number, number]> } | null = null;

  for (const op of fresh) {
    if (!validSnapshot(op.after)) return fail("Bad op.", "bad_request");
    const at = typeof op.at === "string" && !Number.isNaN(Date.parse(op.at)) ? op.at : new Date().toISOString();
    const game = op.meta?.game ?? op.after.game;
    const before = last ?? null;

    if (op.type === "rally") {
      const { error } = await admin.from("match_scores").insert({
        match_id: matchId,
        game_number: game,
        score_a: op.after.scoreA,
        score_b: op.after.scoreB,
        action_type: op.meta?.kind === "point" ? `increment_${op.payload.winner}` : (op.meta?.kind ?? "rally"),
        client_op_id: op.id,
        created_at: at,
        prev_state: before ? { score_a: before.scoreA, score_b: before.scoreB, serve_state: before.serve } : null,
        ...who,
      });
      if (error && !isDup(error)) return fail(error.message, "db", 500);
    } else if (op.type === "undo" && op.meta?.undoes) {
      await admin.from("match_scores").delete().eq("match_id", matchId).eq("client_op_id", op.meta.undoes);
    } else if (op.type === "reopen_setup") {
      await admin.from("match_scores").delete().eq("match_id", matchId).eq("game_number", game);
      const { error } = await admin.from("match_events").insert({
        match_id: matchId,
        tournament_id: match.tournament_id,
        kind: "game_setup_reset",
        payload: { game },
        client_op_id: op.id,
        occurred_at: at,
        ...who,
      });
      if (error && !isDup(error)) return fail(error.message, "db", 500);
    } else if (op.type === "game_started" || op.type === "timer" || op.type === "end_game") {
      const kind = op.type === "timer" ? `timer_${op.payload.event}` : op.type === "end_game" ? "game_ended" : "game_started";
      const payload =
        op.type === "timer"
          ? { ...op.payload, label: timerLabel(op.payload.seconds), game }
          : op.type === "game_started"
            ? { ...op.payload, game, teams: { a: match.team_a_label, b: match.team_b_label } }
            : { game, score: op.after.gameScores[op.after.gameScores.length - 1] ?? null };
      const { error } = await admin.from("match_events").insert({
        match_id: matchId,
        tournament_id: match.tournament_id,
        kind,
        payload,
        client_op_id: op.id,
        occurred_at: at,
        ...who,
      });
      if (error && !isDup(error)) return fail(error.message, "db", 500);
    }

    if (op.type === "end_game" && op.after.status === "completed") {
      completed = { winner: op.meta?.winner ?? (op.after.gamesA > op.after.gamesB ? "a" : "b"), games: op.after.gameScores };
    }
    last = op.after;
  }

  const s = last!;
  const { error: writeError } = await admin
    .from("matches")
    .update({
      score_a: s.scoreA,
      score_b: s.scoreB,
      games_won_a: s.gamesA,
      games_won_b: s.gamesB,
      current_game: s.game,
      game_scores: s.gameScores,
      serve_state: s.serve,
      match_setup: s.setup,
      status: s.status,
      started_at: match.started_at ?? fresh[0].at,
      completed_at: s.status === "completed" ? (match.completed_at ?? new Date().toISOString()) : null,
    })
    .eq("id", matchId);
  if (writeError) return fail(writeError.message, "db", 500);

  // brackets move on once; client_seq is bumped last so a failure here is retried
  if (completed) await advanceAfterResult(matchId, completed.winner, completed.games);
  await admin.from("matches").update({ client_seq: s.seq }).eq("id", matchId);

  const t = match.tournament_id;
  revalidatePath(`/umpire/${t}`);
  revalidatePath(`/umpire/${t}/match/${matchId}`);
  revalidatePath(`/court/${match.court_id ?? matchId}`);
  revalidatePath(`/display/${t}`);
  revalidatePath(`/organizer/tournaments/${t}/queue`);
  revalidatePath(`/organizer/tournaments/${t}/matches`);

  return NextResponse.json({ syncedSeq: s.seq });
}
