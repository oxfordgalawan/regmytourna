"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCKED_BRACKET_STATES, bracketConfigSchema, parseBracketConfig } from "@/lib/bracket-format";


async function loadDivision(divisionId: string) {
  const { data } = await createAdminClient()
    .from("tournament_divisions")
    .select("*")
    .eq("id", divisionId)
    .single();
  return data;
}

function revalidateEvent(tournamentId: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/divisions`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/matches`);
}

export async function updateDivisionFormatAction(divisionId: string, config: unknown) {
  const division = await loadDivision(divisionId);
  if (!division) return { error: "Category not found" };
  await requireOrganizerForTournament(division.tournament_id);

  if (division.challonge_state && LOCKED_BRACKET_STATES.has(division.challonge_state)) {
    return { error: "Play has started in this category, so its format is locked." };
  }
  const parsed = bracketConfigSchema.safeParse(config);
  if (!parsed.success) return { error: "That format isn't valid." };

  const prev = parseBracketConfig(division.bracket_config, division.capacity ?? 16);
  const poolsChanged = JSON.stringify(prev.pools) !== JSON.stringify(parsed.data.pools);
  const finalChanged = prev.final.type !== parsed.data.final.type;
  const bracketConfig =
    poolsChanged || finalChanged ? { ...parsed.data, seedingLayout: undefined } : parsed.data;

  const { error } = await createAdminClient()
    .from("tournament_divisions")
    .update({ bracket_config: bracketConfig })
    .eq("id", divisionId);
  if (error) return { error: error.message };
  revalidateEvent(division.tournament_id);
  return {
    ok: true,
    // an existing Challonge bracket keeps its old settings until recreated
    bracketExists: Boolean(division.challonge_tournament_id),
  };
}
