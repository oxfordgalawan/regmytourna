import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveOrganizerId } from "@/lib/auth/organizer-act-as";
import { requireUser } from "@/lib/auth/require-user";
import type { User } from "@supabase/supabase-js";

async function isOrganizerForUser(userId: string, tournamentId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournament?.owner_id === userId) return true;

  const { data: row } = await admin
    .from("tournament_organizers")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(row);
}

/** Whether the signed-in user may manage this event (includes super-admin act-as). */
export async function isOrganizerForTournament(
  realUserId: string,
  tournamentId: string,
  realUser?: User | null
): Promise<boolean> {
  let effectiveId = realUserId;
  if (realUser && realUser.id === realUserId) {
    effectiveId = await getEffectiveOrganizerId(realUser);
  } else if (!realUser) {
    const user = await requireUser().catch(() => null);
    if (user?.id === realUserId) effectiveId = await getEffectiveOrganizerId(user);
  }
  return isOrganizerForUser(effectiveId, tournamentId);
}

export async function requireOrganizerForTournament(tournamentId: string) {
  const user = await requireUser();
  const allowed = await isOrganizerForTournament(user.id, tournamentId, user);
  if (!allowed) {
    throw new Error("Unauthorized");
  }
  return user;
}
