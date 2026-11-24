import { NextResponse } from "next/server";
import { getQuickScoreSessionByToken, sessionExpired } from "@/lib/quick-score/queries";
import { playersFromSession } from "@/lib/quick-score/players";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getQuickScoreSessionByToken(token);
  if (!row) {
    return NextResponse.json({ error: "Session not found.", code: "not_found" }, { status: 404 });
  }
  if (sessionExpired(row)) {
    return NextResponse.json({ error: "This scoring session has expired.", code: "expired" }, { status: 410 });
  }

  const players = playersFromSession(row);
  return NextResponse.json({
    id: row.id,
    token: row.public_token,
    title: row.title,
    teamALabel: row.team_a_label,
    teamBLabel: row.team_b_label,
    players,
    doubles: row.doubles,
    gamesToWin: row.games_to_win,
    status: row.status,
    currentGame: row.current_game,
    scoreA: row.score_a,
    scoreB: row.score_b,
    gamesWonA: row.games_won_a,
    gamesWonB: row.games_won_b,
    gameScores: row.game_scores,
    serveState: row.serve_state,
    matchSetup: row.match_setup,
    clientSeq: row.client_seq,
    expiresAt: row.expires_at,
  });
}