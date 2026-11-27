"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { checkCrossCategoryEligibility } from "@/lib/registrations/cross-category-eligibility";
import { assertManualEntryEmailAllowed } from "@/lib/registrations/manual-entry-link";
import { getFeeDueCents, getRegistrationBalance } from "@/lib/registrations/payment-balance";
import { expireSubstitutions, refreshMatchLabels } from "@/lib/registrations/team-changes";
import { promoteFromWaitlist, takenInDivision } from "@/lib/registrations/waitlist";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";

const MOVABLE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"] as const;

type Admin = ReturnType<typeof createAdminClient>;

type DivisionRow = {
  id: string;
  name: string;
  format: string;
  capacity: number | null;
  entry_fee_cents: number | null;
  bracket_state: string | null;
};

function revalidateTournament(tournamentId: string, slug?: string | null) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/registrations`);
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  revalidatePath("/entries");
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

async function loadDivision(admin: Admin, divisionId: string, tournamentId: string): Promise<DivisionRow | null> {
  const { data } = await admin
    .from("tournament_divisions")
    .select("id, name, format, capacity, entry_fee_cents, bracket_state")
    .eq("id", divisionId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  return data;
}

function drawStarted(d: DivisionRow) {
  return Boolean(d.bracket_state && d.bracket_state !== "not_started");
}

async function assertTargetRoom(admin: Admin, divisionId: string, extraSlots = 1) {
  const { data: div } = await admin
    .from("tournament_divisions")
    .select("id, capacity, name")
    .eq("id", divisionId)
    .maybeSingle();
  if (!div) return "Category not found.";
  if (!div.capacity) return null;
  const taken = await takenInDivision(divisionId, admin);
  if (taken + extraSlots > div.capacity) return `${div.name} is full (${div.capacity}).`;
  return null;
}

async function assertPlayerCanJoinTarget(
  admin: Admin,
  opts: {
    tournamentId: string;
    targetDivisionId: string;
    userId: string | null;
    email: string | null;
    excludeRegistrationId?: string;
  }
): Promise<string | null> {
  if (opts.userId) {
    const { data: others } = await admin
      .from("registrations")
      .select("id, registered_by, registration_players(user_id)")
      .eq("division_id", opts.targetDivisionId)
      .in("status", [...MOVABLE]);
    const clash = (others ?? [])
      .filter((r) => r.id !== opts.excludeRegistrationId)
      .some(
        (r) =>
          r.registered_by === opts.userId ||
          ((r.registration_players ?? []) as Array<{ user_id: string | null }>).some((p) => p.user_id === opts.userId)
      );
    if (clash) return "One of the players is already on another team in the target category.";
    const cross = await checkCrossCategoryEligibility(opts.userId, opts.tournamentId, opts.targetDivisionId);
    if (!cross.ok) return cross.error;
  }
  if (opts.email) {
    const allowed = await assertManualEntryEmailAllowed(admin, {
      divisionId: opts.targetDivisionId,
      tournamentId: opts.tournamentId,
      email: opts.email,
      excludeRegistrationId: opts.excludeRegistrationId,
    });
    if ("error" in allowed) return allowed.error;
  }
  return null;
}

async function syncPaymentAfterFeeChange(
  admin: Admin,
  registrationId: string,
  feeDueCents: number,
  currentStatus: string
) {
  const balance = await getRegistrationBalance(admin, registrationId, feeDueCents);
  const payment_status = balance.fullyPaid ? "paid" : balance.paidCents > 0 ? "partial" : "pending";
  let status = currentStatus;
  if (payment_status !== "paid" && feeDueCents > 0 && ["confirmed", "awaiting_partner"].includes(currentStatus)) {
    status = "awaiting_payment";
  } else if (payment_status === "paid" && currentStatus === "awaiting_payment") {
    status = "confirmed";
  }
  await admin.from("registrations").update({ payment_status, status }).eq("id", registrationId);
}

/** Move the whole entry to another category (same format). */
export async function moveRegistrationToDivisionAction(registrationId: string, targetDivisionId: string) {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, division_id, team_id, status, payment_status, entry_source, tournaments(slug, entry_fee_cents), tournament_divisions(name, format, bracket_state)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Entry not found." };
  await requireOrganizerForTournament(reg.tournament_id);
  if (!MOVABLE.includes(reg.status as (typeof MOVABLE)[number])) {
    return { error: "This entry can't be moved right now." };
  }
  if (reg.division_id === targetDivisionId) return { error: "Choose a different category." };

  const sourceDiv = relationOne(reg.tournament_divisions) as { format: string; bracket_state: string | null } | null;
  const targetDiv = await loadDivision(admin, targetDivisionId, reg.tournament_id);
  if (!targetDiv) return { error: "Category not found." };
  if (sourceDiv && sourceDiv.format !== targetDiv.format) {
    return { error: "Use the same format (singles or doubles). To move one player, use selected players instead." };
  }
  const sourceFull = await loadDivision(admin, reg.division_id, reg.tournament_id);
  if (sourceFull && drawStarted(sourceFull)) return { error: "This category's draw has already started." };
  if (drawStarted(targetDiv)) return { error: "The target category's draw has already started." };

  const roomErr = await assertTargetRoom(admin, targetDivisionId, 1);
  if (roomErr) return { error: roomErr };

  const { data: players } = await admin
    .from("registration_players")
    .select("id, user_id, guest_email")
    .eq("registration_id", registrationId);
  for (const p of players ?? []) {
    const email = p.guest_email ? normalizePartnerEmail(p.guest_email) : null;
    const clash = await assertPlayerCanJoinTarget(admin, {
      tournamentId: reg.tournament_id,
      targetDivisionId,
      userId: p.user_id,
      email,
      excludeRegistrationId: registrationId,
    });
    if (clash) return { error: clash };
  }

  const tournament = relationOne(reg.tournaments) as { slug: string; entry_fee_cents: number };
  const sourceDivisionId = reg.division_id;

  const { error } = await admin.from("registrations").update({ division_id: targetDivisionId }).eq("id", registrationId);
  if (error) return { error: error.message };

  if (reg.team_id) {
    await admin.from("teams").update({ division_id: targetDivisionId }).eq("id", reg.team_id);
  }

  const feeDue = getFeeDueCents({
    divisionEntryFeeCents: targetDiv.entry_fee_cents,
    tournamentEntryFeeCents: tournament.entry_fee_cents,
  });
  await syncPaymentAfterFeeChange(admin, registrationId, feeDue, reg.status);
  await refreshMatchLabels(registrationId);
  await promoteFromWaitlist(sourceDivisionId).catch(() => undefined);

  revalidateTournament(reg.tournament_id, tournament.slug);
  return { ok: true as const };
}

type PlayerRow = {
  id: string;
  user_id: string | null;
  is_primary: boolean | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
};

/** Move one or more players to another category (creates new entries). */
export async function movePlayersToDivisionAction(
  registrationId: string,
  targetDivisionId: string,
  rowIds: string[]
) {
  const unique = [...new Set(rowIds)];
  if (!unique.length) return { error: "Select at least one player." };

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, division_id, registered_by, status, payment_status, entry_source, tournaments(slug, entry_fee_cents), tournament_divisions(format, bracket_state)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Entry not found." };
  await requireOrganizerForTournament(reg.tournament_id);
  if (!MOVABLE.includes(reg.status as (typeof MOVABLE)[number])) {
    return { error: "This entry can't be changed right now." };
  }

  const { data: allRows } = await admin
    .from("registration_players")
    .select("id, user_id, is_primary, guest_name, guest_email, guest_phone")
    .eq("registration_id", registrationId);
  const rows = (allRows ?? []) as PlayerRow[];
  const selected = rows.filter((r) => unique.includes(r.id));
  if (selected.length !== unique.length) return { error: "Player not found on this entry." };
  if (selected.length >= rows.length) {
    return { error: "To move everyone, use Move entire entry instead." };
  }

  const sourceDiv = relationOne(reg.tournament_divisions) as { format: string; bracket_state: string | null } | null;
  const targetDiv = await loadDivision(admin, targetDivisionId, reg.tournament_id);
  if (!targetDiv) return { error: "Category not found." };
  const sourceFull = await loadDivision(admin, reg.division_id, reg.tournament_id);
  if (sourceFull && drawStarted(sourceFull)) return { error: "This category's draw has already started." };
  if (drawStarted(targetDiv)) return { error: "The target category's draw has already started." };

  const roomErr = await assertTargetRoom(admin, targetDivisionId, selected.length);
  if (roomErr) return { error: roomErr };

  const tournament = relationOne(reg.tournaments) as { slug: string; entry_fee_cents: number };
  const targetFee = getFeeDueCents({
    divisionEntryFeeCents: targetDiv.entry_fee_cents,
    tournamentEntryFeeCents: tournament.entry_fee_cents,
  });

  for (const p of selected) {
    const email = p.guest_email ? normalizePartnerEmail(p.guest_email) : null;
    const clash = await assertPlayerCanJoinTarget(admin, {
      tournamentId: reg.tournament_id,
      targetDivisionId,
      userId: p.user_id,
      email,
    });
    if (clash) return { error: clash };
  }

  const sourceDivisionId = reg.division_id;
  const doublesTarget = targetDiv.format === "doubles";

  for (const p of selected) {
    const needsPartner = doublesTarget;
    const status =
      targetFee > 0
        ? needsPartner
          ? "awaiting_partner"
          : "awaiting_payment"
        : needsPartner
          ? "awaiting_partner"
          : "confirmed";
    const payment_status = targetFee > 0 ? "pending" : "paid";

    const { data: created, error: insErr } = await admin
      .from("registrations")
      .insert({
        tournament_id: reg.tournament_id,
        division_id: targetDivisionId,
        registered_by: reg.registered_by,
        status,
        payment_status,
        entry_source: reg.entry_source,
        needs_partner_since: needsPartner ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (insErr || !created) return { error: insErr?.message ?? "Couldn't create the new entry." };

    const { error: playerErr } = await admin.from("registration_players").insert({
      registration_id: created.id,
      guest_name: p.guest_name,
      guest_phone: p.guest_phone,
      guest_email: p.guest_email,
      user_id: p.user_id,
      is_primary: true,
    });
    if (playerErr) return { error: playerErr.message };
  }

  await admin.from("registration_players").delete().in("id", selected.map((p) => p.id));
  await expireSubstitutions(registrationId);

  const remaining = rows.filter((r) => !unique.includes(r.id));
  if (!remaining.length) {
    await admin
      .from("registrations")
      .update({ status: "cancelled", waitlist_position: null, needs_partner_since: null })
      .eq("id", registrationId);
    await promoteFromWaitlist(sourceDivisionId).catch(() => undefined);
  } else {
    const sourceDoubles = sourceDiv?.format === "doubles";
    if (sourceDoubles && remaining.length === 1) {
      const stay = remaining[0]!;
      if (!stay.is_primary) {
        await admin.from("registration_players").update({ is_primary: true }).eq("id", stay.id);
      }
      await admin
        .from("registrations")
        .update({
          needs_partner_since: new Date().toISOString(),
          ...(stay.user_id ? { registered_by: stay.user_id } : {}),
        })
        .eq("id", registrationId);
    }
    await refreshMatchLabels(registrationId);
  }

  revalidateTournament(reg.tournament_id, tournament.slug);
  return { ok: true as const };
}

/** Remove the partner and leave an empty doubles slot. */
export async function clearPartnerFromEntryAction(registrationId: string, rowId?: string) {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, status, payment_status, tournaments(slug), tournament_divisions(format, bracket_state)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Entry not found." };
  await requireOrganizerForTournament(reg.tournament_id);
  if (!MOVABLE.includes(reg.status as (typeof MOVABLE)[number])) {
    return { error: "This entry can't be changed right now." };
  }

  const division = relationOne(reg.tournament_divisions) as { format: string; bracket_state: string | null } | null;
  if (division?.format !== "doubles") return { error: "This is not a doubles entry." };
  if (division.bracket_state && division.bracket_state !== "not_started") {
    return { error: "This category's draw has already started." };
  }

  const { data: rows } = await admin
    .from("registration_players")
    .select("id, is_primary, user_id")
    .eq("registration_id", registrationId);
  if ((rows?.length ?? 0) < 2) return { error: "There is no partner on this entry." };

  const victim =
    rowId != null
      ? rows?.find((r) => r.id === rowId)
      : rows?.find((r) => !r.is_primary) ?? rows?.find((r) => r.is_primary);
  if (!victim) return { error: "Player not found." };

  const stayer = rows!.find((r) => r.id !== victim.id);
  if (!stayer) return { error: "Player not found." };

  const { error: delErr } = await admin.from("registration_players").delete().eq("id", victim.id);
  if (delErr) return { error: delErr.message };

  if (!stayer.is_primary) {
    await admin.from("registration_players").update({ is_primary: true }).eq("id", stayer.id);
  }

  await admin
    .from("registration_players")
    .update({
      partner_invite_token: null,
      partner_invite_status: null,
      partner_responded_at: null,
      partner_notified_at: null,
    })
    .eq("id", stayer.id);

  const status =
    reg.payment_status === "paid" && reg.status === "confirmed"
      ? "awaiting_partner"
      : reg.status === "awaiting_payment"
        ? "awaiting_payment"
        : reg.status;

  await admin
    .from("registrations")
    .update({
      needs_partner_since: new Date().toISOString(),
      ...(stayer.user_id ? { registered_by: stayer.user_id } : {}),
      status,
    })
    .eq("id", registrationId);

  await expireSubstitutions(registrationId);
  await refreshMatchLabels(registrationId);

  const slug = (relationOne(reg.tournaments) as { slug: string } | null)?.slug;
  revalidateTournament(reg.tournament_id, slug);
  return { ok: true as const };
}