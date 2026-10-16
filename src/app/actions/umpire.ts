"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOCKOUT_MINUTES,
  MAX_PIN_ATTEMPTS,
  bumpUmpireAccessVersion,
  clearUmpireSession,
  clientIp,
  generateUmpirePin,
  getUmpireAccess,
  getUmpireSession,
  hashPin,
  isValidPin,
  issueUmpireSession,
  verifyPin,
  encryptPin,
  decryptPin,
} from "@/lib/auth/umpire";
import { isPlayableMatch } from "@/lib/umpire/playable";

function revalidateUmpirePaths(tournamentId: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/umpires`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/matches`);
  revalidatePath(`/umpire/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/queue`);
}

async function pinLockout(tournamentId: string, action: string) {
  const admin = createAdminClient();
  const ip = await clientIp();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("entity_id", tournamentId)
    .contains("metadata", { ip })
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PIN_ATTEMPTS) {
    return { locked: true, error: `Too many wrong PINs. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }
  return { locked: false, ip, count: count ?? 0 };
}

async function findUmpireByPin(tournamentId: string, pin: string) {
  const admin = createAdminClient();
  const { data: roster } = await admin
    .from("tournament_umpires")
    .select("id, name, pin_hash")
    .eq("tournament_id", tournamentId)
    .eq("active", true);
  for (const u of roster ?? []) {
    if (verifyPin(pin, u.pin_hash as string)) {
      return { id: u.id as string, name: u.name as string };
    }
  }
  return null;
}

async function ensureUniquePinHash(tournamentId: string, pin: string, excludeId?: string) {
  const admin = createAdminClient();
  const h = hashPin(pin);
  const { data: roster } = await admin
    .from("tournament_umpires")
    .select("id, pin_hash")
    .eq("tournament_id", tournamentId)
    .eq("active", true);
  for (const u of roster ?? []) {
    if (excludeId && u.id === excludeId) continue;
    if (verifyPin(pin, u.pin_hash as string)) return null;
  }
  return h;
}

async function generateUniquePin(tournamentId: string, excludeId?: string) {
  for (let i = 0; i < 30; i++) {
    const pin = generateUmpirePin();
    const h = await ensureUniquePinHash(tournamentId, pin, excludeId);
    if (h) return { pin, pin_hash: h };
  }
  return null;
}

export async function createUmpireAction(tournamentId: string, name: string) {
  await requireOrganizerForTournament(tournamentId);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const generated = await generateUniquePin(tournamentId);
  if (!generated) return { error: "Could not generate a unique PIN. Try again." };

  const admin = createAdminClient();
  const row = { tournament_id: tournamentId, name: trimmed, pin_hash: generated.pin_hash };
  let { error } = await admin.from("tournament_umpires").insert({ ...row, pin_encrypted: encryptPin(generated.pin) });
  // before the reveal migration: save without the encrypted copy
  if (error?.message.includes("pin_encrypted")) ({ error } = await admin.from("tournament_umpires").insert(row));
  if (error) return { error: error.message };

  await getUmpireAccess(tournamentId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true, pin: generated.pin };
}

export async function updateUmpireNameAction(tournamentId: string, umpireId: string, name: string) {
  await requireOrganizerForTournament(tournamentId);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  const { error } = await createAdminClient()
    .from("tournament_umpires")
    .update({ name: trimmed })
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function regenerateUmpirePinAction(tournamentId: string, umpireId: string) {
  await requireOrganizerForTournament(tournamentId);
  const generated = await generateUniquePin(tournamentId, umpireId);
  if (!generated) return { error: "Could not generate a unique PIN. Try again." };

  const admin = createAdminClient();
  const update = (fields: Record<string, string>) =>
    admin.from("tournament_umpires").update(fields).eq("id", umpireId).eq("tournament_id", tournamentId);
  let { error } = await update({ pin_hash: generated.pin_hash, pin_encrypted: encryptPin(generated.pin) });
  if (error?.message.includes("pin_encrypted")) ({ error } = await update({ pin_hash: generated.pin_hash }));
  if (error) return { error: error.message };

  await bumpUmpireAccessVersion(tournamentId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true, pin: generated.pin };
}

export async function setUmpireActiveAction(tournamentId: string, umpireId: string, active: boolean) {
  await requireOrganizerForTournament(tournamentId);
  const { error } = await createAdminClient()
    .from("tournament_umpires")
    .update({ active })
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  if (!active) await bumpUmpireAccessVersion(tournamentId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function resetUmpireAccessAction(tournamentId: string) {
  await requireOrganizerForTournament(tournamentId);
  await bumpUmpireAccessVersion(tournamentId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true as const };
}

export async function umpireSignInAction(tournamentId: string, pin: string) {
  const lock = await pinLockout(tournamentId, "umpire.pin_failed");
  if (lock.locked) return { error: lock.error };

  if (!isValidPin(pin)) return { error: "Enter your 4-digit PIN." };

  const umpire = await findUmpireByPin(tournamentId, pin);
  if (!umpire) {
    await createAdminClient().from("audit_logs").insert({
      action: "umpire.pin_failed",
      entity_type: "tournament",
      entity_id: tournamentId,
      metadata: { ip: lock.ip },
    });
    const left = MAX_PIN_ATTEMPTS - (lock.count ?? 0) - 1;
    return {
      error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong PIN.",
    };
  }

  const access = await getUmpireAccess(tournamentId);
  await issueUmpireSession(tournamentId, umpire.id, access?.access_version ?? 0);
  revalidatePath(`/umpire/${tournamentId}`);
  return { ok: true, name: umpire.name };
}

export async function claimMatchAction(tournamentId: string, matchId: string, pin: string): Promise<{ ok?: boolean; matchId?: string; error?: string }> {
  const lock = await pinLockout(tournamentId, "umpire.claim_failed");
  if (lock.locked) return { error: lock.error };

  if (!isValidPin(pin)) return { error: "Enter your 4-digit PIN." };

  const umpire = await findUmpireByPin(tournamentId, pin);
  if (!umpire) {
    await createAdminClient().from("audit_logs").insert({
      action: "umpire.claim_failed",
      entity_type: "tournament",
      entity_id: tournamentId,
      metadata: { ip: lock.ip, matchId },
    });
    const left = MAX_PIN_ATTEMPTS - (lock.count ?? 0) - 1;
    return {
      error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong PIN.",
    };
  }

  const res = await assignClaim(tournamentId, matchId, umpire.id);
  if (res.error) return res;

  const access = await getUmpireAccess(tournamentId);
  await issueUmpireSession(tournamentId, umpire.id, access?.access_version ?? 0);
  revalidateUmpirePaths(tournamentId);
  revalidatePath(`/umpire/${tournamentId}/match/${matchId}`);
  return { ok: true, matchId };
}

/** Claim as the umpire already signed in on this device — no PIN again. */
export async function claimMatchAsSignedInAction(tournamentId: string, matchId: string): Promise<{ ok?: boolean; matchId?: string; error?: string }> {
  const session = await getUmpireSession(tournamentId);
  if (!session) return { error: "Your sign-in expired. Enter your PIN again." };
  const res = await assignClaim(tournamentId, matchId, session.id);
  if (res.error) return res;
  revalidateUmpirePaths(tournamentId);
  revalidatePath(`/umpire/${tournamentId}/match/${matchId}`);
  return { ok: true, matchId };
}

async function assignClaim(tournamentId: string, matchId: string, umpireId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!match || !isPlayableMatch(match) || match.status !== "scheduled") {
    return { error: "This match is not available to claim." };
  }
  if (match.assigned_umpire_id && match.assigned_umpire_id !== umpireId) {
    return { error: "This match is already assigned to another umpire." };
  }

  if (!match.assigned_umpire_id) {
    const { data: updated, error } = await admin
      .from("matches")
      .update({ assigned_umpire_id: umpireId })
      .eq("id", matchId)
      .is("assigned_umpire_id", null)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: "Someone else just claimed this match." };
  }
  return {};
}

export async function assignMatchUmpireAction(
  tournamentId: string,
  matchId: string,
  umpireId: string | null
) {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  if (umpireId) {
    const { data: u } = await admin
      .from("tournament_umpires")
      .select("id")
      .eq("id", umpireId)
      .eq("tournament_id", tournamentId)
      .eq("active", true)
      .maybeSingle();
    if (!u) return { error: "Umpire not found." };
  }
  const { error } = await admin
    .from("matches")
    .update({ assigned_umpire_id: umpireId })
    .eq("id", matchId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function setMatchQueueOrderAction(
  tournamentId: string,
  matchId: string,
  order: number | null
) {
  await requireOrganizerForTournament(tournamentId);
  const { error } = await createAdminClient()
    .from("matches")
    .update({ umpire_queue_order: order })
    .eq("id", matchId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function bumpMatchQueueAction(tournamentId: string, matchId: string, direction: "up" | "down") {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("umpire_queue_order")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!match) return { error: "Match not found." };

  const current = match.umpire_queue_order;
  const { data: peers } = await admin
    .from("matches")
    .select("id, umpire_queue_order")
    .eq("tournament_id", tournamentId)
    .eq("status", "scheduled")
    .not("umpire_queue_order", "is", null)
    .order("umpire_queue_order", { ascending: true });

  const ordered = peers ?? [];
  if (current == null) {
    const max = ordered.reduce((m, p) => Math.max(m, p.umpire_queue_order ?? 0), 0);
    await admin.from("matches").update({ umpire_queue_order: max + 1 }).eq("id", matchId);
  } else {
    const idx = ordered.findIndex((p) => p.id === matchId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const swap = ordered[swapIdx];
    if (swap && swap.umpire_queue_order != null) {
      await admin.from("matches").update({ umpire_queue_order: swap.umpire_queue_order }).eq("id", matchId);
      await admin.from("matches").update({ umpire_queue_order: current }).eq("id", swap.id);
    }
  }
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

async function backfillPoolAssignments(divisionId: string, pool: string, umpireId: string) {
  const admin = createAdminClient();
  const { data: matches } = await admin
    .from("matches")
    .select("id, status, is_bye, is_conditional, team_a_registration_id, team_b_registration_id, stage, assigned_umpire_id")
    .eq("division_id", divisionId)
    .eq("pool", pool)
    .eq("status", "scheduled")
    .is("assigned_umpire_id", null);
  for (const m of matches ?? []) {
    if (isPlayableMatch(m)) {
      await admin.from("matches").update({ assigned_umpire_id: umpireId }).eq("id", m.id);
    }
  }
}

export async function setPoolUmpireAction(
  tournamentId: string,
  divisionId: string,
  pool: string,
  umpireId: string
) {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  const { data: u } = await admin
    .from("tournament_umpires")
    .select("id")
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId)
    .eq("active", true)
    .maybeSingle();
  if (!u) return { error: "Umpire not found." };

  const { error } = await admin.from("umpire_pool_assignments").upsert(
    {
      tournament_id: tournamentId,
      division_id: divisionId,
      pool,
      umpire_id: umpireId,
    },
    { onConflict: "division_id,pool" }
  );
  if (error) return { error: error.message };

  await backfillPoolAssignments(divisionId, pool, umpireId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function clearPoolUmpireAction(tournamentId: string, divisionId: string, pool: string) {
  await requireOrganizerForTournament(tournamentId);
  const { error } = await createAdminClient()
    .from("umpire_pool_assignments")
    .delete()
    .eq("division_id", divisionId)
    .eq("pool", pool)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

export async function umpireSignOutAction(tournamentId: string) {
  await clearUmpireSession(tournamentId);
  revalidatePath(`/umpire/${tournamentId}`);
  return { ok: true };
}

/** @deprecated Shared PIN removed — kept so old imports fail loudly if any remain. */
export async function setUmpirePinAction(_tournamentId: string, _pin: string) {
  return { error: "Use the umpire roster instead of a shared PIN." };
}

/**
 * Removes an umpire without losing their history: they're signed out, their
 * unstarted matches go back to "claimable", and they can be restored later.
 */
export async function deleteUmpireAction(tournamentId: string, umpireId: string) {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("tournament_umpires")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId);
  if (error) {
    return {
      error: error.message.includes("deleted_at")
        ? "Deleting umpires needs the latest database migration — run it and try again."
        : error.message,
    };
  }
  await admin
    .from("matches")
    .update({ assigned_umpire_id: null })
    .eq("tournament_id", tournamentId)
    .eq("assigned_umpire_id", umpireId)
    .eq("status", "scheduled");
  await admin.from("umpire_pool_assignments").delete().eq("tournament_id", tournamentId).eq("umpire_id", umpireId);
  await bumpUmpireAccessVersion(tournamentId);
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

/** Brings a deleted umpire back (same name and PIN). */
export async function restoreUmpireAction(tournamentId: string, umpireId: string) {
  await requireOrganizerForTournament(tournamentId);
  const { error } = await createAdminClient()
    .from("tournament_umpires")
    .update({ deleted_at: null, active: true })
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateUmpirePaths(tournamentId);
  return { ok: true };
}

/** Shows one umpire's PIN to an organizer of this event (decrypted on demand). */
export async function revealUmpirePinAction(tournamentId: string, umpireId: string) {
  await requireOrganizerForTournament(tournamentId);
  const { data } = await createAdminClient()
    .from("tournament_umpires")
    .select("*")
    .eq("id", umpireId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!data) return { error: "Umpire not found." };
  if (!("pin_encrypted" in data)) {
    return { error: "PIN reveal isn't set up yet — the database update (umpire_pin_reveal migration) hasn't been applied." };
  }
  const pin = decryptPin((data as { pin_encrypted?: string | null }).pin_encrypted);
  if (!pin) {
    return {
      error: "This PIN was created before PINs could be shown. Tap New PIN once — after that you can reveal it any time.",
    };
  }
  return { ok: true as const, pin };
}
