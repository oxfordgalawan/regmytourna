import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuickScoreSessionRow } from "@/lib/quick-score/types";

const TOKEN_RE = /^[a-zA-Z0-9_-]{16,64}$/;

export function isQuickScoreToken(token: string) {
  return TOKEN_RE.test(token);
}

export async function getQuickScoreSessionByToken(token: string): Promise<QuickScoreSessionRow | null> {
  if (!isQuickScoreToken(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("quick_score_sessions").select("*").eq("public_token", token).maybeSingle();
  if (!data) return null;
  return rowToSession(data);
}

export function sessionExpired(row: Pick<QuickScoreSessionRow, "expires_at">) {
  return new Date(row.expires_at).getTime() < Date.now();
}

export function rowToSession(data: Record<string, unknown>): QuickScoreSessionRow {
  const names = data.player_names as QuickScoreSessionRow["player_names"] | null;
  return {
    id: data.id as string,
    public_token: data.public_token as string,
    title: (data.title as string | null) ?? null,
    team_a_label: data.team_a_label as string,
    team_b_label: data.team_b_label as string,
    player_names: names?.a && names?.b ? names : { a: [], b: [] },
    doubles: Boolean(data.doubles),
    games_to_win: Number(data.games_to_win) || 2,
    status: data.status as string,
    current_game: Number(data.current_game) || 1,
    score_a: Number(data.score_a) || 0,
    score_b: Number(data.score_b) || 0,
    games_won_a: Number(data.games_won_a) || 0,
    games_won_b: Number(data.games_won_b) || 0,
    game_scores: Array.isArray(data.game_scores) ? (data.game_scores as Array<[number, number]>) : null,
    serve_state: (data.serve_state as QuickScoreSessionRow["serve_state"]) ?? null,
    match_setup: (data.match_setup as QuickScoreSessionRow["match_setup"]) ?? null,
    client_seq: Number(data.client_seq) || 0,
    started_at: (data.started_at as string | null) ?? null,
    completed_at: (data.completed_at as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    expires_at: data.expires_at as string,
  };
}