"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOCKOUT_MINUTES,
  MAX_PIN_ATTEMPTS,
  clearUmpireSession,
  clientIp,
  getUmpireAccess,
  hashPin,
  isValidPin,
  issueUmpireSession,
  verifyPin,
} from "@/lib/auth/umpire";

/** Organizer sets (or changes) the umpire PIN. Existing umpire sessions stay valid. */
export async function setUmpirePinAction(tournamentId: string, pin: string) {
  await requireOrganizerForTournament(tournamentId);
  if (!isValidPin(pin)) return { error: "Use 4 to 6 digits." };
  const { error } = await createAdminClient()
    .from("tournament_umpire_access")
    .upsert(
      { tournament_id: tournamentId, pin_hash: hashPin(pin), updated_at: new Date().toISOString() },
      { onConflict: "tournament_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(`/organizer/tournaments/${tournamentId}/umpires`);
  return { ok: true };
}

/** Removes the PIN and signs every umpire out (bumps the access version). */
export async function resetUmpireAccessAction(tournamentId: string) {
  await requireOrganizerForTournament(tournamentId);
  const current = await getUmpireAccess(tournamentId);
  const { error } = await createAdminClient()
    .from("tournament_umpire_access")
    .upsert(
      {
        tournament_id: tournamentId,
        pin_hash: null,
        access_version: (current?.access_version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tournament_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(`/organizer/tournaments/${tournamentId}/umpires`);
  return { ok: true };
}

export async function umpireSignInAction(tournamentId: string, pin: string) {
  const admin = createAdminClient();
  const ip = await clientIp();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();

  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "umpire.pin_failed")
    .eq("entity_id", tournamentId)
    .contains("metadata", { ip })
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PIN_ATTEMPTS) {
    return { error: `Too many wrong PINs. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }

  const access = await getUmpireAccess(tournamentId);
  if (!access?.pin_hash) {
    return { error: "Umpire scoring isn't switched on for this event yet. Ask the organizer." };
  }

  if (!isValidPin(pin) || !verifyPin(pin, access.pin_hash)) {
    await admin.from("audit_logs").insert({
      action: "umpire.pin_failed",
      entity_type: "tournament",
      entity_id: tournamentId,
      metadata: { ip },
    });
    const left = MAX_PIN_ATTEMPTS - (count ?? 0) - 1;
    return {
      error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong PIN.",
    };
  }

  await issueUmpireSession(tournamentId, access.access_version);
  revalidatePath(`/umpire/${tournamentId}`);
  return { ok: true };
}

export async function umpireSignOutAction(tournamentId: string) {
  await clearUmpireSession(tournamentId);
  revalidatePath(`/umpire/${tournamentId}`);
  return { ok: true };
}
