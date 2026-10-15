import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { checkPartnerEmailConflict, normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";
import { promoteFromWaitlist } from "@/lib/registrations/waitlist";
import { sendRegistrationEmail } from "@/lib/email/send";
import {
  entryCancelledEmail,
  partnerLeftEmail,
  partnerRemovedEmail,
  substituteAcceptedForLeaverEmail,
  substituteDeclinedEmail,
  substituteInviteEmail,
  substituteJoinedForPartnerEmail,
  type EventInfo,
} from "@/lib/email/team-email";

/**
 * Team changes made by players: leave, cancel, change partner, find a substitute.
 *
 * The captain (owner/payer) is the primary player row. When the captain
 * leaves, the player who stays becomes captain. Everything locks once the
 * category's draw has started — then only the organizer can change teams.
 */

type Result<T = object> = ({ ok: true } & T) | { ok?: undefined; error: string };

export const ACTIVE_STATUSES = ["confirmed", "awaiting_payment", "pending", "awaiting_partner", "waitlisted"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TeamRow = {
  id: string;
  user_id: string | null;
  is_primary: boolean;
  guest_name: string | null;
  guest_email: string | null;
  partner_invite_token: string | null;
  name: string;
};

export type Substitution = {
  id: string;
  registration_id: string;
  leaving_row_id: string;
  requested_by: string;
  substitute_name: string;
  substitute_email: string;
  token: string;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
};

export type Team = {
  id: string;
  status: string;
  paymentStatus: string;
  entrySource: string;
  tournamentId: string;
  divisionId: string;
  registeredBy: string;
  needsPartnerSince: string | null;
  doubles: boolean;
  locked: boolean;
  active: boolean;
  event: EventInfo;
  slug: string;
  rows: TeamRow[];
  captain: TeamRow | null;
  pending: Substitution | null;
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const entryUrl = (registrationId: string) => `${appUrl()}/entries#entry-${registrationId}`;

export async function loadTeam(registrationId: string): Promise<Team | null> {
  const admin = createAdminClient();
  const [{ data: reg }, { data: subs }] = await Promise.all([
    admin
      .from("registrations")
      .select(
        "id, status, payment_status, entry_source, tournament_id, division_id, registered_by, needs_partner_since, tournament_divisions(name, format, bracket_state), tournaments(name, slug, start_date, end_date, venue_name, city), registration_players(id, user_id, is_primary, guest_name, guest_email, partner_invite_token, profiles(full_name))"
      )
      .eq("id", registrationId)
      .maybeSingle(),
    admin.from("entry_substitutions").select("*").eq("registration_id", registrationId).eq("status", "pending").limit(1),
  ]);
  if (!reg) return null;
  const d = relationOne(reg.tournament_divisions) as { name: string; format: string; bracket_state: string | null } | null;
  const t = relationOne(reg.tournaments) as {
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
  } | null;
  const rows: TeamRow[] = ((reg.registration_players ?? []) as Array<TeamRow & { profiles: unknown }>)
    .map((r) => ({
      id: r.id,
      user_id: r.user_id,
      is_primary: Boolean(r.is_primary),
      guest_name: r.guest_name,
      guest_email: r.guest_email,
      partner_invite_token: r.partner_invite_token,
      name: (relationOne(r.profiles as never) as { full_name: string | null } | null)?.full_name || r.guest_name || "Player",
    }))
    .sort((x, y) => Number(y.is_primary) - Number(x.is_primary));
  return {
    id: reg.id,
    status: reg.status,
    paymentStatus: reg.payment_status,
    entrySource: reg.entry_source ?? "online",
    tournamentId: reg.tournament_id,
    divisionId: reg.division_id,
    registeredBy: reg.registered_by,
    needsPartnerSince: reg.needs_partner_since ?? null,
    doubles: d?.format === "doubles",
    locked: Boolean(d?.bracket_state && d.bracket_state !== "not_started"),
    active: ACTIVE_STATUSES.includes(reg.status),
    slug: t?.slug ?? "",
    event: {
      tournamentName: t?.name ?? "Tournament",
      categoryName: d?.name ?? "Category",
      startDate: t?.start_date ?? null,
      endDate: t?.end_date ?? null,
      venue: [t?.venue_name, t?.city].filter(Boolean).join(", ") || null,
    },
    rows,
    captain: rows.find((r) => r.is_primary) ?? null,
    pending: ((subs ?? [])[0] as Substitution | undefined) ?? null,
  };
}

export const isCaptain = (team: Team, userId: string) => Boolean(userId && team.captain?.user_id === userId);
export const rowOf = (team: Team, userId: string) => team.rows.find((r) => r.user_id === userId) ?? null;
const otherRow = (team: Team, row: TeamRow) => team.rows.find((r) => r.id !== row.id) ?? null;

/** Who the given user is on this team, with the guards every player action shares. */
export function playerGuard(team: Team | null, userId: string): Result<{ team: Team; me: TeamRow }> {
  if (!team) return { error: "Entry not found." };
  const me = rowOf(team, userId);
  if (!me) return { error: "You're not on this entry." };
  if (!team.active) return { error: "This entry is no longer active." };
  if (team.locked) return { error: "The draw has started — ask the organizer to make changes." };
  return { ok: true, team, me };
}

async function emailOf(row: Pick<TeamRow, "user_id" | "guest_email">) {
  if (row.user_id) {
    const { data } = await createAdminClient().auth.admin.getUserById(row.user_id);
    if (data?.user?.email) return data.user.email;
  }
  return row.guest_email;
}

async function send(to: string | null | undefined, mail: { subject: string; html: string }) {
  if (!to) return;
  await sendRegistrationEmail({ to, ...mail }).catch(() => undefined);
}

/** Keeps drawn matches showing the current team name. */
export async function refreshMatchLabels(registrationId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("registrations").select(`id, ${REGISTRATION_PLAYERS_SELECT}`).eq("id", registrationId).single();
  if (!data) return;
  const label = registrationName(data);
  await Promise.all([
    admin.from("matches").update({ team_a_label: label }).eq("team_a_registration_id", registrationId),
    admin.from("matches").update({ team_b_label: label }).eq("team_b_registration_id", registrationId),
  ]);
}

export async function expireSubstitutions(registrationId: string, status: "expired" | "withdrawn" = "expired") {
  await createAdminClient()
    .from("entry_substitutions")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("registration_id", registrationId)
    .eq("status", "pending");
}

/** Cancels the whole entry, frees the slot for the waitlist, and tells the other player. */
export async function cancelEntry(team: Team, byUserId: string | null): Promise<Result> {
  const admin = createAdminClient();
  await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", team.id).eq("status", "pending");
  const { error } = await admin
    .from("registrations")
    .update({ status: "cancelled", waitlist_position: null, needs_partner_since: null })
    .eq("id", team.id);
  if (error) return { error: error.message };
  await expireSubstitutions(team.id);
  await promoteFromWaitlist(team.divisionId).catch(() => undefined);

  const by = team.rows.find((r) => r.user_id && r.user_id === byUserId);
  for (const r of team.rows) {
    if (by && r.id === by.id) continue;
    await send(await emailOf(r), entryCancelledEmail({ event: team.event, byName: by?.name ?? "Your partner" }));
  }
  return { ok: true };
}

/**
 * The player on `row` leaves. The other player keeps the slot (paid or not)
 * and is asked to invite a new partner or cancel. Singles — or a team with
 * nobody left — is simply cancelled.
 */
export async function leaveTeam(team: Team, row: TeamRow): Promise<Result<{ cancelled?: boolean }>> {
  const stayer = otherRow(team, row);
  if (!team.doubles || !stayer) {
    const res = await cancelEntry(team, row.user_id);
    return "error" in res ? res : { ok: true, cancelled: true };
  }

  const admin = createAdminClient();
  await expireSubstitutions(team.id);
  const { error } = await admin.from("registration_players").delete().eq("id", row.id);
  if (error) return { error: error.message };

  // the player who stays is captain now
  await admin.from("registration_players").update({ is_primary: true }).eq("id", stayer.id);
  await admin
    .from("registrations")
    .update({
      needs_partner_since: new Date().toISOString(),
      ...(stayer.user_id ? { registered_by: stayer.user_id } : {}),
    })
    .eq("id", team.id);
  await refreshMatchLabels(team.id);

  // a guest who stays gets a fresh link to claim the entry
  let token = stayer.partner_invite_token;
  if (!stayer.user_id && stayer.guest_email && !token) {
    token = randomBytes(24).toString("hex");
    await admin
      .from("registration_players")
      .update({ partner_invite_token: token, partner_invite_status: "pending" })
      .eq("id", stayer.id);
  }
  await send(
    await emailOf(stayer),
    partnerLeftEmail({
      event: team.event,
      leaverName: row.name,
      stayerName: stayer.name,
      paid: team.paymentStatus === "paid",
      hasAccount: Boolean(stayer.user_id),
      url: stayer.user_id || !token ? entryUrl(team.id) : `${appUrl()}/invite/${token}`,
    })
  );
  return { ok: true };
}

async function validateNewPlayerEmail(team: Team, email: string, actingUserId: string, actingEmail?: string | null) {
  if (!EMAIL_RE.test(email)) return "Enter a valid email.";
  if (actingEmail && normalizePartnerEmail(actingEmail) === email) return "That's your own email.";
  for (const r of team.rows) {
    const e = await emailOf(r);
    if (e && normalizePartnerEmail(e) === email) return `${r.name} is already on this team.`;
  }
  const conflict = await checkPartnerEmailConflict({
    tournamentId: team.tournamentId,
    divisionId: team.divisionId,
    partnerEmail: email,
    excludeUserId: actingUserId,
  });
  return conflict.blocked ?? null;
}

/** Captain swaps the partner right away (or adds one after their partner left). */
export async function changePartner(
  team: Team,
  captainUserId: string,
  captainEmail: string | null | undefined,
  next: { name: string; email: string }
): Promise<Result> {
  if (!team.doubles) return { error: "This is a singles entry." };
  const name = next.name.trim().replace(/\s+/g, " ");
  const email = next.email.trim() ? normalizePartnerEmail(next.email) : "";
  if (name.length < 2) return { error: "Enter your partner's full name." };
  if (email) {
    const problem = await validateNewPlayerEmail(team, email, captainUserId, captainEmail);
    if (problem) return { error: problem };
  }

  const admin = createAdminClient();
  const old = team.rows.find((r) => !r.is_primary) ?? null;
  const oldEmail = old ? await emailOf(old) : null;
  const fields = {
    user_id: null,
    guest_name: name,
    guest_email: email || null,
    partner_invite_status: email ? ("pending" as const) : null,
    partner_invite_token: email ? randomBytes(24).toString("hex") : null,
    partner_notified_at: null,
    partner_responded_at: null,
  };
  const { error } = old
    ? await admin.from("registration_players").update(fields).eq("id", old.id)
    : await admin.from("registration_players").insert({ registration_id: team.id, is_primary: false, ...fields });
  if (error) return { error: error.message };

  await admin.from("registrations").update({ needs_partner_since: null }).eq("id", team.id);
  await expireSubstitutions(team.id);
  await refreshMatchLabels(team.id);

  if (old && oldEmail && (!email || normalizePartnerEmail(oldEmail) !== email)) {
    await send(oldEmail, partnerRemovedEmail({ event: team.event, captainName: team.captain?.name ?? "Your partner" }));
  }
  const holdsSlot = team.paymentStatus === "paid" || (team.entrySource !== "online" && team.status !== "waitlisted");
  if (email && holdsSlot) await notifyPartnerAfterRegistration(team.id).catch(() => undefined);
  return { ok: true };
}

/** "Find someone to take my place" — nothing changes until they accept. */
export async function createSubstitution(
  team: Team,
  me: TeamRow,
  requester: { id: string; email?: string | null },
  sub: { name: string; email: string }
): Promise<Result> {
  if (team.pending) return { error: "You already have a substitute invite waiting. Withdraw it first to ask someone else." };
  const name = sub.name.trim().replace(/\s+/g, " ");
  const email = normalizePartnerEmail(sub.email);
  if (name.length < 2) return { error: "Enter their full name." };
  const problem = await validateNewPlayerEmail(team, email, requester.id, requester.email);
  if (problem) return { error: problem };

  const token = randomBytes(24).toString("hex");
  const { error } = await createAdminClient().from("entry_substitutions").insert({
    registration_id: team.id,
    leaving_row_id: me.id,
    requested_by: requester.id,
    substitute_name: name,
    substitute_email: email,
    token,
  });
  if (error) {
    return {
      error: error.message.includes("entry_substitutions")
        ? "Team changes aren't set up yet — run the latest database migration."
        : error.message,
    };
  }
  await sendSubstituteInvite(team, me, { substitute_email: email, token });
  return { ok: true };
}

export async function sendSubstituteInvite(
  team: Team,
  leaving: TeamRow,
  sub: Pick<Substitution, "substitute_email" | "token">
) {
  const partner = otherRow(team, leaving);
  await send(
    sub.substitute_email,
    substituteInviteEmail({
      event: team.event,
      requesterName: leaving.name,
      partnerName: partner?.name ?? null,
      paid: team.paymentStatus === "paid",
      url: `${appUrl()}/substitute/${sub.token}`,
    })
  );
}

export async function findSubstitution(token: string) {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const { data } = await createAdminClient().from("entry_substitutions").select("*").eq("token", token).maybeSingle();
  if (!data) return null;
  const sub = data as Substitution;
  const team = await loadTeam(sub.registration_id);
  if (!team) return null;
  // stale requests show as expired
  const leaving = team.rows.find((r) => r.id === sub.leaving_row_id) ?? null;
  if (sub.status === "pending" && (!team.active || team.locked || !leaving)) {
    await expireSubstitutions(team.id);
    sub.status = "expired";
  }
  return { sub, team, leaving };
}

/** The substitute accepts: they take the leaving player's place. */
export async function acceptSubstitution(token: string, userId: string): Promise<Result<{ registrationId: string }>> {
  const found = await findSubstitution(token);
  if (!found) return { error: "This invite link isn't valid." };
  const { sub, team, leaving } = found;
  if (sub.status !== "pending" || !leaving) return { error: "This invite is no longer open." };
  if (rowOf(team, userId)) return { error: "You're already on this team." };

  const admin = createAdminClient();
  // one team per category
  const { data: others } = await admin
    .from("registrations")
    .select("id, registration_players(user_id)")
    .eq("division_id", team.divisionId)
    .in("status", ACTIVE_STATUSES)
    .neq("id", team.id);
  if ((others ?? []).some((r) => ((r.registration_players ?? []) as Array<{ user_id: string | null }>).some((p) => p.user_id === userId))) {
    return { error: `You're already on another team in ${team.event.categoryName}.` };
  }

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const leaverEmail = await emailOf(leaving);
  const stayer = otherRow(team, leaving);

  const { error } = await admin
    .from("registration_players")
    .update({
      user_id: userId,
      guest_name: profile?.full_name || sub.substitute_name,
      guest_email: sub.substitute_email,
      partner_invite_status: "accepted",
      partner_responded_at: new Date().toISOString(),
    })
    .eq("id", leaving.id);
  if (error) return { error: error.message };

  // if the captain left, the player who stays takes over (when they have an account)
  let captainId = team.registeredBy;
  if (leaving.is_primary) {
    if (stayer?.user_id) {
      await admin.from("registration_players").update({ is_primary: false }).eq("id", leaving.id);
      await admin.from("registration_players").update({ is_primary: true }).eq("id", stayer.id);
      captainId = stayer.user_id;
    } else {
      captainId = userId;
    }
  }
  await admin.from("registrations").update({ registered_by: captainId, needs_partner_since: null }).eq("id", team.id);
  await admin
    .from("entry_substitutions")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", sub.id);
  await admin.from("profiles").update({ player_enabled: true }).eq("id", userId);
  await refreshMatchLabels(team.id);

  const subName = profile?.full_name || sub.substitute_name;
  await send(leaverEmail, substituteAcceptedForLeaverEmail({ event: team.event, substituteName: subName }));
  if (stayer) {
    await send(
      await emailOf(stayer),
      substituteJoinedForPartnerEmail({
        event: team.event,
        substituteName: subName,
        leaverName: leaving.name,
        entriesUrl: entryUrl(team.id),
      })
    );
  }
  return { ok: true, registrationId: team.id };
}

export async function declineSubstitution(token: string): Promise<Result> {
  const found = await findSubstitution(token);
  if (!found) return { error: "This invite link isn't valid." };
  const { sub, team } = found;
  if (sub.status !== "pending") return { ok: true };
  await createAdminClient()
    .from("entry_substitutions")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", sub.id);
  const requester = team.rows.find((r) => r.user_id === sub.requested_by);
  if (requester) {
    await send(
      await emailOf(requester),
      substituteDeclinedEmail({ event: team.event, substituteName: sub.substitute_name, entriesUrl: entryUrl(team.id) })
    );
  }
  return { ok: true };
}

/** Quick check used by payment and cancel paths: is this user the entry's captain? */
export async function isCaptainOf(registrationId: string, userId: string) {
  const { data } = await createAdminClient()
    .from("registration_players")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  return Boolean(data);
}
