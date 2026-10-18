import type { SupabaseClient } from "@supabase/supabase-js";
import { revertResult, type EngineMatch } from "@/lib/bracket-engine";
import { gamesToWinFromDivisionConfig } from "@/lib/bracket-format";
import { loadDivisionContext, MATCH_SELECT, writePatches } from "@/lib/draw/server";
import { advanceAfterResult, refreshDivisionState } from "@/lib/draw/progress";
import {
  reconcileMatchToGamesToWin,
  type MatchScoreState,
  type ReconcileUpdate,
  type TrimPreview,
  type TrimPreviewMatch,
} from "@/lib/scoring/reconcile-games-to-win";
type MatchRow = Record<string, unknown> & { id: string; current_game?: number };

function rowToScoreState(r: MatchRow, m: EngineMatch): MatchScoreState {
  return {
    gameScores: m.gameScores,
    gamesWonA: m.gamesA ?? 0,
    gamesWonB: m.gamesB ?? 0,
    scoreA: m.scoreA ?? 0,
    scoreB: m.scoreB ?? 0,
    status: m.status,
    currentGame: (r.current_game as number) ?? 1,
    winnerRegistrationId: m.winner,
    teamARegistrationId: m.a,
    teamBRegistrationId: m.b,
  };
}

function previewItem(m: EngineMatch, extra: Partial<TrimPreviewMatch> = {}): TrimPreviewMatch {
  return {
    matchId: m.id,
    matchNumber: m.matchNumber,
    roundLabel: m.roundLabel,
    winnerChanges: false,
    ...extra,
  };
}

export async function buildGamesToWinTrimPreview(divisionId: string, newGamesToWin: number): Promise<TrimPreview | null> {
  const ctx = await loadDivisionContext(divisionId);
  if (!ctx) return null;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const client = createAdminClient();
  const { data: rows } = await client
    .from("matches")
    .select(`${MATCH_SELECT}, current_game`)
    .eq("division_id", divisionId);
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r as MatchRow]));

  let toUpdate = 0;
  let winnerChanges = 0;
  const blocked: TrimPreviewMatch[] = [];
  const needsManual: TrimPreviewMatch[] = [];

  for (const m of ctx.matches) {
    if (m.isBye) continue;
    const row = byId.get(m.id);
    if (!row) continue;
    const result = reconcileMatchToGamesToWin(rowToScoreState(row, m), newGamesToWin);
    if (result.kind === "unchanged") continue;
    if (result.kind === "needs_manual") {
      needsManual.push(previewItem(m, { reason: result.reason }));
      continue;
    }
    if (result.winnerChanged) {
      const rev = revertResult(ctx.matches, m.id);
      if ("error" in rev) {
        blocked.push(previewItem(m, { reason: rev.error, winnerChanges: true }));
        continue;
      }
      winnerChanges += 1;
    }
    toUpdate += 1;
  }

  return { toUpdate, winnerChanges, blocked, needsManual };
}

export async function applyGamesToWinTrim(
  admin: SupabaseClient,
  divisionId: string,
  newGamesToWin: number
): Promise<{ error?: string }> {
  let ctx = await loadDivisionContext(divisionId);
  if (!ctx) return { error: "Category not found" };

  const oldGamesToWin = gamesToWinFromDivisionConfig(ctx.config);
  if (newGamesToWin >= oldGamesToWin) return {};

  const preview = await buildGamesToWinTrimPreview(divisionId, newGamesToWin);
  if (!preview) return { error: "Category not found" };
  if (preview.needsManual.length) {
    return {
      error: `M${preview.needsManual[0].matchNumber} (${preview.needsManual[0].roundLabel}) needs a manual correction first.`,
    };
  }
  if (preview.blocked.length) {
    return {
      error: `M${preview.blocked[0].matchNumber}: ${preview.blocked[0].reason}`,
    };
  }

  const { data: rows } = await admin
    .from("matches")
    .select(`${MATCH_SELECT}, current_game`)
    .eq("division_id", divisionId);
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r as MatchRow]));

  const plans: Array<{ m: EngineMatch; winnerChanged: boolean; update: ReconcileUpdate }> = [];

  for (const m of ctx.matches) {
    if (m.isBye) continue;
    const row = byId.get(m.id);
    if (!row) continue;
    const result = reconcileMatchToGamesToWin(rowToScoreState(row, m), newGamesToWin);
    if (result.kind !== "update") continue;
    plans.push({ m, winnerChanged: result.winnerChanged, update: result.update });
  }

  for (const { m } of plans.filter((p) => p.winnerChanged)) {
    ctx = (await loadDivisionContext(divisionId))!;
    const rev = revertResult(ctx.matches, m.id);
    if ("error" in rev) return { error: rev.error };
    await writePatches(rev.patches);
  }

  for (const { m, update } of plans) {
    const completed = update.status === "completed";
    const { error } = await admin
      .from("matches")
      .update({
        game_scores: update.gameScores,
        games_won_a: update.gamesWonA,
        games_won_b: update.gamesWonB,
        score_a: update.scoreA,
        score_b: update.scoreB,
        current_game: update.currentGame,
        serve_state: null,
        match_setup: null,
        status: update.status,
        winner_registration_id: completed ? update.winnerRegistrationId : null,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", m.id);
    if (error) return { error: error.message };

    if (update.trimFromGame != null) {
      await admin.from("match_scores").delete().eq("match_id", m.id).gte("game_number", update.trimFromGame);
    }
  }

  for (const { m, update, winnerChanged } of plans) {
    if (winnerChanged && update.status === "completed" && update.winnerSide) {
      await advanceAfterResult(m.id, update.winnerSide, update.gameScores);
    }
  }

  ctx = (await loadDivisionContext(divisionId))!;
  await refreshDivisionState(ctx, ctx.matches);

  return {};
}
