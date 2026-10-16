"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";
import { expireSubstitutions, refreshMatchLabels } from "@/lib/registrations/team-changes";

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner", "waitlisted"];

/**
 * Organizer swaps a player on an entry — e.g. a partner can't make it on the day.
 * Online entries: only the partner can change (the registrant owns the entry).
 * Desk walk-ins: either player can change. Payment and the slot stay as they are,
 * and the new name flows into any matches already drawn.
 */
export async function replacePlayerAction(
  registrationId: string,
  rowId: string,
  next: { name: string; email: string }
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, tournament_id, division_id, status, payment_status, entry_source, tournaments(slug)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Entry not found." };
  await requireOrganizerForTournament(reg.tournament_id);
  if (["cancelled", "refunded"].includes(reg.status)) return { error: "This entry is no longer active." };

  const { data: row } = await admin
    .from("registration_players")
    .select("id, registration_id, is_primary, user_id, guest_email")
    .eq("id", rowId)
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (!row) return { error: "Player not found on this entry." };
  if (row.is_primary && reg.entry_source !== "desk" && reg.entry_source !== "import") {
    return { error: "The player who registered online can't be replaced — only their partner." };
  }

  const name = next.name.trim().replace(/\s+/g, " ");
  const email = next.email.trim() ? normalizePartnerEmail(next.email) : "";
  if (name.length < 2) return { error: "Enter the player's full name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email or leave it blank." };

  // the same email can't be on two teams in one category
  if (email && email !== (row.guest_email ?? "").toLowerCase()) {
    const { data: others } = await admin
      .from("registrations")
      .select("id")
      .eq("division_id", reg.division_id)
      .in("status", ACTIVE)
      .neq("id", registrationId);
    const ids = (others ?? []).map((o) => o.id);
    if (ids.length) {
      const { count } = await admin
        .from("registration_players")
        .select("id", { count: "exact", head: true })
        .in("registration_id", ids)
        .ilike("guest_email", email);
      if ((count ?? 0) > 0) return { error: "That email is already on another team in this category." };
    }
  }

  const isPartner = !row.is_primary;
  const { error } = await admin
    .from("registration_players")
    .update({
      user_id: null,
      guest_name: name,
      guest_email: email || null,
      ...(isPartner
        ? {
            partner_invite_status: email ? "pending" : null,
            partner_invite_token: email ? randomBytes(24).toString("hex") : null,
            partner_notified_at: null,
            partner_responded_at: null,
          }
        : {}),
    })
    .eq("id", row.id);
  if (error) return { error: error.message };

  // keep drawn matches showing the right team name; any "take my place" request is settled by this
  await refreshMatchLabels(registrationId);
  await expireSubstitutions(registrationId);
  if (isPartner) await admin.from("registrations").update({ needs_partner_since: null }).eq("id", registrationId);

  // new partner with an email hears they're in (once the entry holds a slot)
  const holdsSlot = reg.payment_status === "paid" || (reg.entry_source !== "online" && reg.status !== "waitlisted");
  if (isPartner && email && holdsSlot) {
    await notifyPartnerAfterRegistration(registrationId).catch(() => undefined);
  }

  const slug = (relationOne(reg.tournaments) as { slug: string } | null)?.slug;
  revalidatePath(`/organizer/tournaments/${reg.tournament_id}/registrations`);
  revalidatePath(`/organizer/tournaments/${reg.tournament_id}/draw`);
  revalidatePath("/entries");
  if (slug) revalidatePath(`/tournaments/${slug}`);
  return { ok: true };
}

/**
 * Fixes a mistyped email on an entry (guests only — an account's email belongs
 * to the player). For a partner, a fresh invite goes to the corrected address.
 */
export async function updatePlayerEmailAction(
  registrationId: string,
  rowId: string,
  rawEmail: string
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, tournament_id, division_id, status, payment_status, entry_source, tournaments(slug)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Entry not found." };
  await requireOrganizerForTournament(reg.tournament_id);

  const { data: row } = await admin
    .from("registration_players")
    .select("id, is_primary, user_id, guest_email")
    .eq("id", rowId)
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (!row) return { error: "Player not found on this entry." };
  if (row.user_id) return { error: "This player has an account — their email can only be changed by them." };

  const email = rawEmail.trim() ? normalizePartnerEmail(rawEmail) : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email or leave it blank." };
  if (email === (row.guest_email ?? "").toLowerCase()) return { ok: true };

  if (email) {
    const { data: others } = await admin
      .from("registrations")
      .select("id")
      .eq("division_id", reg.division_id)
      .in("status", ACTIVE)
      .neq("id", registrationId);
    const ids = (others ?? []).map((o) => o.id);
    if (ids.length) {
      const { count } = await admin
        .from("registration_players")
        .select("id", { count: "exact", head: true })
        .in("registration_id", ids)
        .ilike("guest_email", email);
      if ((count ?? 0) > 0) return { error: "That email is already on another team in this category." };
    }
  }

  const isPartner = !row.is_primary;
  const { error } = await admin
    .from("registration_players")
    .update({
      guest_email: email || null,
      // the old invite link went to the wrong address — retire it
      ...(isPartner
        ? {
            partner_invite_status: email ? "pending" : null,
            partner_invite_token: email ? randomBytes(24).toString("hex") : null,
            partner_notified_at: null,
            partner_responded_at: null,
          }
        : {}),
    })
    .eq("id", row.id);
  if (error) return { error: error.message };

  const holdsSlot = reg.payment_status === "paid" || (reg.entry_source !== "online" && reg.status !== "waitlisted");
  if (isPartner && email && holdsSlot) {
    await notifyPartnerAfterRegistration(registrationId).catch(() => undefined);
  }

  const slug = (relationOne(reg.tournaments) as { slug: string } | null)?.slug;
  revalidatePath(`/organizer/tournaments/${reg.tournament_id}/registrations`);
  revalidatePath("/entries");
  if (slug) revalidatePath(`/tournaments/${slug}`);
  return { ok: true };
}
