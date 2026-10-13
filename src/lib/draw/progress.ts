import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyResult,
  currentSwissRound,
  stageDone,
  type EngineMatch,
  type GameScore,
} from "@/lib/bracket-engine";
import { loadDivisionContext, setDivisionState, writePatches, type DivisionContext } from "./server";

const POOL = new Set(["pool"]);

/** Moves a category's state forward when a stage finishes (pools done, category complete). */
export async function refreshDivisionState(ctx: DivisionContext, matches: EngineMatch[]) {
  const state = ctx.division.bracket_state;
  const nonPool = matches.filter((m) => m.stage !== "pool");

  if (state === "pools" && stageDone(matches, POOL)) {
    await setDivisionState(ctx.division.id, "pools_done");
    return "pools_done";
  }
  if (state === "final" && nonPool.length && stageDone(nonPool)) {
    const swissUnfinished =
      ctx.config.final.type === "swiss" && currentSwissRound(nonPool) < ctx.config.final.rounds;
    if (!swissUnfinished) {
      await setDivisionState(ctx.division.id, "complete");
      return "complete";
    }
  }
  return state;
}

/**
 * After a match is decided (by scoring or a typed-in result): move the winner
 * and loser on, resolve byes/walkovers, and update the category's state.
 */
export async function advanceAfterResult(
  matchId: string,
  winnerSide: "a" | "b",
  gameScores: GameScore[] | null,
  status: "completed" | "walkover" = "completed"
) {
  const { data: row } = await createAdminClient()
    .from("matches")
    .select("division_id, stage")
    .eq("id", matchId)
    .maybeSingle();
  // matches created before native brackets (no stage) have nothing to advance
  if (!row?.division_id || !row.stage) return;

  const ctx = await loadDivisionContext(row.division_id);
  if (!ctx) return;
  const m = ctx.matches.find((x) => x.id === matchId);
  const winner = m ? (winnerSide === "a" ? m.a : m.b) : null;
  if (!m || !winner) return;

  const patches = applyResult(ctx.matches, matchId, winner, gameScores, { names: ctx.names, withdrawn: ctx.withdrawn }, status);
  await writePatches(patches);

  const byId = new Map(ctx.matches.map((x) => [x.id, x]));
  for (const p of patches) Object.assign(byId.get(p.id)!, p);
  await refreshDivisionState(ctx, [...byId.values()]);
  await revalidateDraw(ctx.division.tournament_id, ctx.division.id);
}

/** Every page that shows a category's draw. */
export async function revalidateDraw(tournamentId: string, divisionId: string) {
  const { data: t } = await createAdminClient().from("tournaments").select("slug").eq("id", tournamentId).maybeSingle();
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw/${divisionId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/matches`);
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/umpire/${tournamentId}`);
  if (t?.slug) revalidatePath(`/tournaments/${t.slug}`);
}
