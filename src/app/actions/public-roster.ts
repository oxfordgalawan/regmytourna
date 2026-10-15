"use server";

import { createClient } from "@/lib/supabase/server";
import { loadPublicDivisionRoster } from "@/lib/registrations/public-roster";

export async function getPublicDivisionRosterAction(tournamentSlug: string, divisionId: string) {
  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, is_public")
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (!tournament?.is_public) return { error: "Tournament not found." };
  return loadPublicDivisionRoster(tournament.id, divisionId);
}
