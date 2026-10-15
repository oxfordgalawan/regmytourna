import { createAdminClient } from "@/lib/supabase/admin";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";

export const PETITION_ELIGIBLE_STATUSES = [
  "confirmed",
  "awaiting_payment",
  "pending",
  "awaiting_partner",
  "waitlisted",
] as const;

export type PetitionEligibility = {
  eligible: boolean;
  reason?: "not_signed_in" | "not_registered" | "pending_exists" | "invite_pending";
  /** set with "invite_pending": the partner invite to accept first */
  inviteToken?: string | null;
  registrationId?: string;
  tournamentId?: string;
  entryName?: string;
  existingPetition?: {
    id: string;
    status: "pending" | "approved" | "rejected";
    reason: string;
    createdAt: string;
    reviewerNote?: string | null;
  };
};

export async function getPetitionEligibilityForUser(
  userId: string,
  tournamentId: string,
  divisionId: string
): Promise<PetitionEligibility> {
  const admin = createAdminClient();

  const { data: regs } = await admin
    .from("registrations")
    .select(`id, status, registered_by, registration_players(guest_name, is_primary, user_id, profiles(full_name))`)
    .eq("tournament_id", tournamentId)
    .eq("division_id", divisionId)
    .in("status", [...PETITION_ELIGIBLE_STATUSES]);

  const owned = (regs ?? []).filter(
    (r) =>
      r.registered_by === userId ||
      (Array.isArray(r.registration_players) &&
        r.registration_players.some((p: { user_id: string | null }) => p.user_id === userId))
  );

  if (!owned.length) {
    return { eligible: false, reason: "not_registered" };
  }

  const registration = owned[0];
  const registrationId = registration.id as string;

  const { data: petitions } = await admin
    .from("entry_petitions")
    .select("id, status, reason, created_at, reviewer_note")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false });

  const pending = petitions?.find((p) => p.status === "pending");
  if (pending) {
    return {
      eligible: false,
      reason: "pending_exists",
      registrationId,
      tournamentId,
      entryName: registrationName(registration),
      existingPetition: {
        id: pending.id,
        status: pending.status as "pending",
        reason: pending.reason,
        createdAt: pending.created_at,
      },
    };
  }

  const latest = petitions?.[0];
  return {
    eligible: true,
    registrationId,
    tournamentId,
    entryName: registrationName(registration),
    existingPetition: latest
      ? {
          id: latest.id,
          status: latest.status as "approved" | "rejected",
          reason: latest.reason,
          createdAt: latest.created_at,
          reviewerNote: latest.reviewer_note,
        }
      : undefined,
  };
}
