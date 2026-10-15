"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import {
  declinePartner,
  findInviteByToken,
  linkPartner,
  pendingInvitesForEmail,
  type PartnerInvite,
} from "@/lib/registrations/partner-invites";
import { checkPartnerEmailConflict, normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";

type Result = { ok?: true; error?: string };

function refresh(invite: Pick<PartnerInvite, "tournament">) {
  revalidatePath("/entries");
  revalidatePath("/dashboard");
  revalidatePath(`/tournaments/${invite.tournament.slug}`);
  revalidatePath(`/organizer/tournaments/${invite.tournament.id}/registrations`);
}

/** From the /invite/<token> page: the token in the link is the proof. */
export async function acceptPartnerInviteAction(token: string): Promise<Result> {
  const user = await requireUser(`/invite/${token}`);
  const invite = await findInviteByToken(token);
  if (!invite) return { error: "This invite link isn't valid anymore." };
  if (invite.linkedUserId === user.id) return { ok: true };
  const res = await linkPartner(invite, user.id);
  if (res.ok) refresh(invite);
  return res;
}

export async function declinePartnerInviteAction(token: string): Promise<Result> {
  const invite = await findInviteByToken(token);
  if (!invite) return { error: "This invite link isn't valid anymore." };
  if (invite.status === "declined") return { ok: true };
  const res = await declinePartner(invite);
  if (res.ok) refresh(invite);
  return res;
}

/** From the Home card: the invite must have been sent to this account's email. */
async function ownInvite(rowId: string) {
  const user = await requireUser();
  const invite = (await pendingInvitesForEmail(user.email)).find((i) => i.rowId === rowId);
  return { user, invite };
}

export async function acceptInviteForMeAction(rowId: string): Promise<Result> {
  const { user, invite } = await ownInvite(rowId);
  if (!invite) return { error: "This invite isn't available anymore." };
  const res = await linkPartner(invite, user.id);
  if (res.ok) refresh(invite);
  return res;
}

export async function declineInviteForMeAction(rowId: string): Promise<Result> {
  const { invite } = await ownInvite(rowId);
  if (!invite) return { error: "This invite isn't available anymore." };
  const res = await declinePartner(invite);
  if (res.ok) refresh(invite);
  return res;
}

/** Registrant-only checks shared by Resend and Change partner. */
async function ownEntry(registrationId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, registered_by, tournament_id, division_id, status, tournaments(id, slug), tournament_divisions(bracket_state)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.registered_by !== user.id) return { error: "Only the player who registered this entry can do that." };
  if (["cancelled", "refunded"].includes(reg.status)) return { error: "This entry is no longer active." };
  const division = relationOne(reg.tournament_divisions) as { bracket_state: string | null } | null;
  if (division?.bracket_state && division.bracket_state !== "not_started") {
    return { error: "The draw has started — ask the organizer to change partners." };
  }
  const tournament = relationOne(reg.tournaments) as { id: string; slug: string } | null;
  return { user, admin, reg, tournament };
}

export async function resendPartnerInviteAction(registrationId: string): Promise<Result> {
  const entry = await ownEntry(registrationId);
  if ("error" in entry) return { error: entry.error };
  const sent = await notifyPartnerAfterRegistration(registrationId, { force: true });
  if ("error" in sent && sent.error) return { error: sent.error };
  if ("skipped" in sent && sent.skipped) return { error: "Email isn't set up yet, or there's no partner email to send to." };
  return { ok: true };
}

export async function changePartnerAction(
  registrationId: string,
  partner: { name: string; email: string }
): Promise<Result> {
  const entry = await ownEntry(registrationId);
  if ("error" in entry) return { error: entry.error };
  const { user, admin, reg, tournament } = entry;

  const name = partner.name.trim();
  const email = partner.email.trim() ? normalizePartnerEmail(partner.email) : "";
  if (!name) return { error: "Enter your partner's name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email or leave it blank." };
  if (email && user.email && normalizePartnerEmail(user.email) === email) {
    return { error: "That's your own email — enter your partner's." };
  }
  if (email) {
    const conflict = await checkPartnerEmailConflict({
      tournamentId: reg.tournament_id,
      divisionId: reg.division_id,
      partnerEmail: email,
      excludeUserId: user.id,
    });
    if (conflict.blocked) return { error: conflict.blocked };
  }

  const { data: row } = await admin
    .from("registration_players")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("is_primary", false)
    .maybeSingle();
  if (!row) return { error: "This entry doesn't have a partner slot." };

  const { error } = await admin
    .from("registration_players")
    .update({
      user_id: null,
      guest_name: name,
      guest_email: email || null,
      partner_invite_status: email ? "pending" : null,
      partner_invite_token: email ? randomBytes(24).toString("hex") : null,
      partner_notified_at: null,
      partner_responded_at: null,
    })
    .eq("id", row.id);
  if (error) return { error: error.message };

  if (email) await notifyPartnerAfterRegistration(registrationId).catch(() => undefined);
  if (tournament) refresh({ tournament: { id: tournament.id, slug: tournament.slug } } as PartnerInvite);
  return { ok: true };
}
