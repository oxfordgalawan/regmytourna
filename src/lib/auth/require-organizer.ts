import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

export async function isOrganizerForTournament(
  userId: string,
  tournamentId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournament?.owner_id === userId) return true;

  const { data: row } = await supabase
    .from("tournament_organizers")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(row);
}

export async function requireOrganizerForTournament(tournamentId: string) {
  const user = await requireUser();
  const allowed = await isOrganizerForTournament(user.id, tournamentId);
  if (!allowed) {
    throw new Error("Unauthorized");
  }
  return user;
}
