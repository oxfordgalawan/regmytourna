import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { sendPartnerDeclinedEmail } from "@/lib/email/send";

/**
 * Partner invites. When someone registers a doubles team they add their
 * partner's email; the partner gets a link (/invite/<token>) to see the entry
 * and, if they want, link it to their account. The entry itself never waits on
 * this — it counts once paid.
 */

export type PartnerInvite = {
  rowId: string;
  token: string | null;
  status: "pending" | "accepted" | "declined" | "expired";
  partnerName: string | null;
  partnerEmail: string | null;
  linkedUserId: string | null;
  registrationId: string;
  registrationStatus: string;
  paymentStatus: string;
  registrantId: string;
  registrantName: string;
  /** the partner who registered left — this player was left holding the slot and becomes captain */
  partnerLeft: boolean;
  divisionId: string;
  categoryName: string;
  tournament: {
    id: string;
    name: string;
    slug: string;
    startDate: string | null;
    endDate: string | null;
    venueName: string | null;
    city: string | null;
    coverImageUrl: string | null;
  };
};

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"];

const INVITE_SELECT =
  "id, guest_name, guest_email, user_id, is_primary, partner_invite_status, partner_invite_token, registrations!inner(id, status, payment_status, registered_by, needs_partner_since, division_id, tournament_divisions(name), tournaments(id, name, slug, start_date, end_date, venue_name, city, cover_image_url))";

type InviteRow = {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  user_id: string | null;
  is_primary: boolean | null;
  partner_invite_status: PartnerInvite["status"] | null;
  partner_invite_token: string | null;
  registrations: unknown;
};

async function toInvite(row: InviteRow): Promise<PartnerInvite | null> {
  const reg = relationOne(row.registrations as never) as {
    id: string;
    status: string;
    payment_status: string;
    registered_by: string;
    needs_partner_since: string | null;
    division_id: string;
    tournament_divisions: unknown;
    tournaments: unknown;
  } | null;
  if (!reg) return null;
  const t = relationOne(reg.tournaments as never) as {
    id: string;
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
    cover_image_url: string | null;
  } | null;
  if (!t) return null;
  const { data: registrant } = await createAdminClient()
    .from("profiles")
    .select("full_name")
    .eq("id", reg.registered_by)
    .maybeSingle();
  return {
    rowId: row.id,
    token: row.partner_invite_token,
    status: row.partner_invite_status ?? "pending",
    partnerName: row.guest_name,
    partnerEmail: row.guest_email,
    linkedUserId: row.user_id,
    registrationId: reg.id,
    registrationStatus: reg.status,
    paymentStatus: reg.payment_status,
    registrantId: reg.registered_by,
    partnerLeft: Boolean(row.is_primary && reg.needs_partner_since),
    registrantName: registrant?.full_name || "Your partner",
    divisionId: reg.division_id,
    categoryName: (relationOne(reg.tournament_divisions as never) as { name: string } | null)?.name ?? "Category",
    tournament: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      startDate: t.start_date,
      endDate: t.end_date,
      venueName: t.venue_name,
      city: t.city,
      coverImageUrl: t.cover_image_url,
    },
  };
}

export async function findInviteByToken(token: string): Promise<PartnerInvite | null> {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const { data } = await createAdminClient()
    .from("registration_players")
    .select(INVITE_SELECT)
    .eq("partner_invite_token", token)
    .maybeSingle();
  return data ? toInvite(data as InviteRow) : null;
}

/** Pending invites sent to this email that nobody has claimed yet (for the Home card). */
export async function pendingInvitesForEmail(email: string | null | undefined): Promise<PartnerInvite[]> {
  if (!email) return [];
  const { data } = await createAdminClient()
    .from("registration_players")
    .select(INVITE_SELECT)
    .ilike("guest_email", normalizePartnerEmail(email))
    .is("user_id", null)
    .or("partner_invite_status.is.null,partner_invite_status.eq.pending");
  const invites = await Promise.all(((data ?? []) as InviteRow[]).map(toInvite));
  return invites.filter(
    (i): i is PartnerInvite =>
      i !== null &&
      ACTIVE.includes(i.registrationStatus) &&
      // partners, plus guests whose partner left them holding the slot (not desk walk-ins)
      (!((data ?? []) as InviteRow[]).find((r) => r.id === i.rowId)?.is_primary || i.partnerLeft)
  );
}

/**
 * Links the invite to this account. Refuses if they're already in another
 * active entry in the same category (one team per category).
 */
export async function linkPartner(invite: PartnerInvite, userId: string): Promise<{ ok?: true; error?: string }> {
  if (invite.registrantId === userId && !invite.partnerLeft) return { error: "That's your own entry — you're already on it." };
  if (invite.status === "declined") return { error: "This invite was declined. Ask your partner to add you again." };
  if (invite.linkedUserId && invite.linkedUserId !== userId) {
    return { error: "This invite has already been accepted by another account." };
  }
  if (!ACTIVE.includes(invite.registrationStatus)) return { error: "This entry is no longer active." };

  const admin = createAdminClient();
  // already playing in this category on another team?
  const { data: others } = await admin
    .from("registrations")
    .select("id, registered_by, registration_players(user_id)")
    .eq("division_id", invite.divisionId)
    .in("status", ACTIVE)
    .neq("id", invite.registrationId);
  const clash = (others ?? []).some(
    (r) =>
      r.registered_by === userId ||
      ((r.registration_players ?? []) as Array<{ user_id: string | null }>).some((p) => p.user_id === userId)
  );
  if (clash) return { error: `You're already on another team in ${invite.categoryName}.` };

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const { error } = await admin
    .from("registration_players")
    .update({
      user_id: userId,
      partner_invite_status: "accepted",
      partner_responded_at: new Date().toISOString(),
      ...(invite.partnerName ? {} : { guest_name: profile?.full_name ?? null }),
    })
    .eq("id", invite.rowId);
  if (error) return { error: error.message };
  // left holding the slot: they're the captain now
  if (invite.partnerLeft) await admin.from("registrations").update({ registered_by: userId }).eq("id", invite.registrationId);
  // they're a player now, whatever they signed up as
  await admin.from("profiles").update({ player_enabled: true }).eq("id", userId);
  return { ok: true };
}

/** "Not me": unlink, mark declined, and tell the registrant to update their partner. */
export async function declinePartner(invite: PartnerInvite): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("registration_players")
    .update({ user_id: null, partner_invite_status: "declined", partner_responded_at: new Date().toISOString() })
    .eq("id", invite.rowId);
  if (error) return { error: error.message };

  const { data: registrant } = await admin.auth.admin.getUserById(invite.registrantId);
  const to = registrant?.user?.email;
  if (to) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendPartnerDeclinedEmail({
      to,
      tournamentName: invite.tournament.name,
      divisionName: invite.categoryName,
      partnerLabel: invite.partnerName || invite.partnerEmail || "Your partner",
      entriesUrl: `${appUrl}/entries`,
    }).catch(() => undefined);
  }
  return { ok: true };
}
