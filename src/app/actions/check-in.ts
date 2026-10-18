"use server";

import { requireUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkInAction(tournamentId: string, registrationId: string) {
  const user = await requireUser();
  const allowed = await isOrganizerForTournament(user.id, tournamentId, user);
  if (!allowed) throw new Error("Unauthorized");

  const admin = createAdminClient();
  await admin.from("check_ins").upsert(
    {
      tournament_id: tournamentId,
      registration_id: registrationId,
      checked_in_by: user.id,
      checked_in_at: new Date().toISOString(),
    },
    { onConflict: "tournament_id,registration_id" }
  );

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "check_in.manual",
    entity_type: "registration",
    entity_id: registrationId,
    metadata: { tournament_id: tournamentId },
  });
}
