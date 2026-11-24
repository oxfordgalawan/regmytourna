"use client";

import { PickleballScoring } from "@/components/scoring/pickleball-scoring";
import { playersFromSession } from "@/lib/quick-score/players";
import { sessionAsMatch } from "@/lib/quick-score/session-match";
import type { QuickScoreSessionRow } from "@/lib/quick-score/types";

export function QuickScoreScorer({
  session,
  tvUrl,
}: {
  session: QuickScoreSessionRow;
  tvUrl: string;
}) {
  const match = sessionAsMatch(session) as Parameters<typeof PickleballScoring>[0]["match"];
  const players = playersFromSession(session);
  const syncUrl = `/api/quick-score/${session.public_token}/sync`;

  return (
    <PickleballScoring
      mode="quick"
      match={match}
      tournamentId=""
      courtName={session.title?.trim() || "Free scoring"}
      backHref="/umpire-tool"
      backLabel="Umpire tool"
      doubles={session.doubles}
      gamesToWin={session.games_to_win}
      players={players}
      events={[]}
      syncUrl={syncUrl}
      tvUrl={tvUrl}
    />
  );
}