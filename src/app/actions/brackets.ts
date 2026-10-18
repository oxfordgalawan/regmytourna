"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOCKED_BRACKET_STATES,
  bracketConfigSchema,
  gamesToWinFromDivisionConfig,
  parseBracketConfig,
  type BracketConfig,
} from "@/lib/bracket-format";
import { buildGamesToWinTrimPreview, applyGamesToWinTrim } from "@/lib/scoring/apply-games-to-win-trim";
import { revalidateDraw } from "@/lib/draw/progress";

async function loadDivision(divisionId: string) {
  const { data } = await createAdminClient()
    .from("tournament_divisions")
    .select("*")
    .eq("id", divisionId)
    .single();
  return data;
}

function revalidateEvent(tournamentId: string, divisionId?: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/divisions`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/matches`);
  if (divisionId) {
    revalidatePath(`/organizer/tournaments/${tournamentId}/draw/${divisionId}`);
    revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  }
}

function structuralConfigChanged(prev: BracketConfig, next: BracketConfig): boolean {
  return (
    prev.preset !== next.preset ||
    JSON.stringify(prev.pools) !== JSON.stringify(next.pools) ||
    JSON.stringify(prev.final) !== JSON.stringify(next.final) ||
    JSON.stringify(prev.seedingLayout ?? null) !== JSON.stringify(next.seedingLayout ?? null)
  );
}

export async function previewDivisionGamesToWinAction(divisionId: string, gamesToWin: number) {
  const division = await loadDivision(divisionId);
  if (!division) return { error: "Category not found" };
  await requireOrganizerForTournament(division.tournament_id);

  const preview = await buildGamesToWinTrimPreview(divisionId, gamesToWin);
  if (!preview) return { error: "Category not found" };
  return { ok: true as const, preview };
}

export async function updateDivisionFormatAction(
  divisionId: string,
  config: unknown,
  opts?: { confirmTrim?: boolean }
) {
  const division = await loadDivision(divisionId);
  if (!division) return { error: "Category not found" };
  await requireOrganizerForTournament(division.tournament_id);

  const parsed = bracketConfigSchema.safeParse(config);
  if (!parsed.success) return { error: "That format isn't valid." };

  const prev = parseBracketConfig(division.bracket_config, division.capacity ?? 16);
  const structural = structuralConfigChanged(prev, parsed.data);
  const bracketStarted = (division.bracket_state ?? "not_started") !== "not_started";
  const challongeLocked = Boolean(division.challonge_state && LOCKED_BRACKET_STATES.has(division.challonge_state));

  if (structural) {
    if (challongeLocked) {
      return { error: "Play has started in this category, so its format is locked." };
    }
    if (bracketStarted) {
      return { error: "Can't change the preset or pool layout after play has started. You can still adjust Best of and tiebreakers." };
    }
  }

  const oldGamesToWin = gamesToWinFromDivisionConfig(prev);
  const newGamesToWin = gamesToWinFromDivisionConfig(parsed.data);
  const loweringBestOf = newGamesToWin < oldGamesToWin && bracketStarted;

  if (loweringBestOf) {
    const preview = await buildGamesToWinTrimPreview(divisionId, newGamesToWin);
    if (!preview) return { error: "Category not found" };
    if (preview.needsManual.length) {
      return {
        error: `M${preview.needsManual[0].matchNumber} (${preview.needsManual[0].roundLabel}) needs a manual correction before lowering Best of.`,
      };
    }
    if (preview.blocked.length) {
      return { error: `M${preview.blocked[0].matchNumber}: ${preview.blocked[0].reason}` };
    }
    if (preview.toUpdate > 0 && !opts?.confirmTrim) {
      return { needsConfirm: true as const, preview };
    }
    if (preview.toUpdate > 0) {
      const trim = await applyGamesToWinTrim(createAdminClient(), divisionId, newGamesToWin);
      if (trim.error) return { error: trim.error };
    }
  }

  const poolsChanged = JSON.stringify(prev.pools) !== JSON.stringify(parsed.data.pools);
  const finalChanged = prev.final.type !== parsed.data.final.type;
  const bracketConfig =
    poolsChanged || finalChanged ? { ...parsed.data, seedingLayout: undefined } : parsed.data;

  const { error } = await createAdminClient()
    .from("tournament_divisions")
    .update({ bracket_config: bracketConfig })
    .eq("id", divisionId);
  if (error) return { error: error.message };

  revalidateEvent(division.tournament_id, divisionId);
  await revalidateDraw(division.tournament_id, divisionId);
  return {
    ok: true,
    bracketExists: Boolean(division.challonge_tournament_id),
  };
}
