import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { sendRegistrationEmail } from "@/lib/email/send";
import { organizerInviteEmail } from "@/lib/email/organizer-email";

/**
 * Co-organizers. The owner invites people by email or with a share link;
 * accepting adds them to tournament_organizers. Co-organizers run the event;
 * only the owner manages the team (and the money stays in the owner's wallet).
 */

export type TeamMember = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  owner: boolean;
};
export type PendingInvite = { id: string; email: string; createdAt: string };

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const joinUrl = (token: string) => `${appUrl()}/join/${token}`;
const newToken = () => randomBytes(24).toString("hex");

export function migrationMessage(message: string) {
  return message.includes("organizer_invites")
    ? "Co-organizers need the latest database migration — run it and try again."
    : message;
}

async function emailsFor(ids: string[]) {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await admin.rpc("auth_emails_for_users", { p_ids: ids });
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ id: string; email: string | null }>) if (r.email) map.set(r.id, r.email);
    return map;
  }
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) map.set(id, u.user.email);
    })
  );
  return map;
}

export async function isOwner(tournamentId: string, userId: string) {
  const { data } = await createAdminClient().from("tournaments").select("owner_id").eq("id", tournamentId).maybeSingle();
  return data?.owner_id === userId;
}

export async function loadTeam(tournamentId: string) {
  const admin = createAdminClient();
  const [{ data: t }, { data: members }, invitesRes] = await Promise.all([
    admin.from("tournaments").select("id, name, owner_id, profiles!tournaments_owner_id_fkey(full_name, avatar_url)").eq("id", tournamentId).maybeSingle(),
    admin.from("tournament_organizers").select("user_id, role, profiles(full_name, avatar_url)").eq("tournament_id", tournamentId),
    admin.from("organizer_invites").select("id, kind, email, token, status, created_at").eq("tournament_id", tournamentId).eq("status", "pending"),
  ]);
  if (!t) return null;
  const ownerProfile = relationOne(t.profiles as never) as { full_name: string | null; avatar_url: string | null } | null;
  const others = (members ?? []).filter((m) => m.user_id !== t.owner_id);
  const emails = await emailsFor([t.owner_id, ...others.map((m) => m.user_id)]);

  const team: TeamMember[] = [
    {
      userId: t.owner_id,
      name: ownerProfile?.full_name || "Owner",
      email: emails.get(t.owner_id) ?? null,
      avatarUrl: ownerProfile?.avatar_url ?? null,
      owner: true,
    },
    ...others.map((m) => {
      const p = relationOne(m.profiles as never) as { full_name: string | null; avatar_url: string | null } | null;
      return {
        userId: m.user_id,
        name: p?.full_name || emails.get(m.user_id) || "Co-organizer",
        email: emails.get(m.user_id) ?? null,
        avatarUrl: p?.avatar_url ?? null,
        owner: false,
      };
    }),
  ];

  const invites = invitesRes.error ? [] : (invitesRes.data ?? []);
  return {
    tournament: { id: t.id, name: t.name as string, ownerId: t.owner_id as string },
    team,
    pending: invites
      .filter((i) => i.kind === "email")
      .map((i) => ({ id: i.id, email: i.email as string, createdAt: i.created_at })) as PendingInvite[],
    link: invites.find((i) => i.kind === "link")?.token ?? null,
    ready: !invitesRes.error,
  };
}

async function sendInvite(tournamentId: string, email: string, token: string, inviterId: string) {
  const admin = createAdminClient();
  const [{ data: t }, { data: inviter }, { data: existing }] = await Promise.all([
    admin.from("tournaments").select("name").eq("id", tournamentId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", inviterId).maybeSingle(),
    admin.rpc("auth_user_id_for_email", { p_email: email }),
  ]);
  await sendRegistrationEmail({
    to: email,
    ...organizerInviteEmail({
      inviterName: inviter?.full_name || "An organizer",
      tournamentName: t?.name ?? "an event",
      hasAccount: Boolean(existing),
      url: joinUrl(token),
    }),
  }).catch(() => undefined);
}

export async function inviteByEmail(tournamentId: string, rawEmail: string, inviterId: string): Promise<{ ok?: true; error?: string }> {
  const email = normalizePartnerEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  const team = await loadTeam(tournamentId);
  if (!team) return { error: "Event not found." };
  if (team.team.some((m) => m.email && normalizePartnerEmail(m.email) === email)) {
    return { error: "They're already on the team." };
  }
  const pending = team.pending.find((p) => normalizePartnerEmail(p.email) === email);
  if (pending) return { error: "They already have an invite waiting — use Resend." };

  const token = newToken();
  const { error } = await createAdminClient()
    .from("organizer_invites")
    .insert({ tournament_id: tournamentId, kind: "email", email, token, invited_by: inviterId });
  if (error) return { error: migrationMessage(error.message) };
  await sendInvite(tournamentId, email, token, inviterId);
  return { ok: true };
}

export async function resendInvite(tournamentId: string, inviteId: string, inviterId: string) {
  const { data } = await createAdminClient()
    .from("organizer_invites")
    .select("email, token, status")
    .eq("id", inviteId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!data || data.status !== "pending" || !data.email) return { error: "That invite isn't open." };
  await sendInvite(tournamentId, data.email, data.token, inviterId);
  return { ok: true as const };
}

export async function revokeInvite(tournamentId: string, inviteId: string) {
  const { error } = await createAdminClient()
    .from("organizer_invites")
    .update({ status: "revoked", responded_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("tournament_id", tournamentId);
  return error ? { error: error.message } : { ok: true as const };
}

/** Turns the share link on (new token) or off. */
export async function setShareLink(tournamentId: string, on: boolean, inviterId: string) {
  const admin = createAdminClient();
  const { error: offError } = await admin
    .from("organizer_invites")
    .update({ status: "revoked", responded_at: new Date().toISOString() })
    .eq("tournament_id", tournamentId)
    .eq("kind", "link")
    .eq("status", "pending");
  if (offError) return { error: migrationMessage(offError.message) };
  if (!on) return { ok: true as const, token: null };
  const token = newToken();
  const { error } = await admin
    .from("organizer_invites")
    .insert({ tournament_id: tournamentId, kind: "link", token, invited_by: inviterId });
  if (error) return { error: migrationMessage(error.message) };
  return { ok: true as const, token };
}

export async function findInvite(token: string) {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizer_invites")
    .select("id, tournament_id, kind, email, status, invited_by, tournaments(id, name, slug, start_date, end_date, venue_name, city, cover_image_url, owner_id)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const t = relationOne(data.tournaments as never) as {
    id: string;
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
    cover_image_url: string | null;
    owner_id: string;
  } | null;
  if (!t) return null;
  const { data: inviter } = data.invited_by
    ? await admin.from("profiles").select("full_name").eq("id", data.invited_by).maybeSingle()
    : { data: null };
  return {
    id: data.id as string,
    kind: data.kind as "email" | "link",
    email: data.email as string | null,
    status: data.status as string,
    inviterName: inviter?.full_name || "The organizer",
    tournament: t,
  };
}

export async function isMember(tournamentId: string, userId: string) {
  const admin = createAdminClient();
  const [{ data: t }, { data: row }] = await Promise.all([
    admin.from("tournaments").select("owner_id").eq("id", tournamentId).maybeSingle(),
    admin.from("tournament_organizers").select("id").eq("tournament_id", tournamentId).eq("user_id", userId).maybeSingle(),
  ]);
  return t?.owner_id === userId || Boolean(row);
}

export async function acceptInvite(token: string, user: { id: string; email?: string | null }) {
  const invite = await findInvite(token);
  if (!invite || invite.status !== "pending") return { error: "This invite isn't open anymore. Ask the organizer for a new one." };
  if (
    invite.kind === "email" &&
    invite.email &&
    normalizePartnerEmail(invite.email) !== normalizePartnerEmail(user.email ?? "")
  ) {
    return { error: `This invite was sent to ${invite.email}. Sign in with that email to accept it.` };
  }
  const admin = createAdminClient();
  if (!(await isMember(invite.tournament.id, user.id))) {
    const { error } = await admin
      .from("tournament_organizers")
      .insert({ tournament_id: invite.tournament.id, user_id: user.id, role: "admin" });
    if (error && !error.message.includes("duplicate")) return { error: error.message };
  }
  // email invites are one-time; the share link stays open for others
  if (invite.kind === "email") {
    await admin
      .from("organizer_invites")
      .update({ status: "accepted", accepted_by: user.id, responded_at: new Date().toISOString() })
      .eq("id", invite.id);
  }
  await admin.from("profiles").update({ organizer_enabled: true }).eq("id", user.id);
  return { ok: true as const, tournamentId: invite.tournament.id };
}

export async function declineInvite(token: string) {
  const invite = await findInvite(token);
  if (!invite || invite.kind !== "email" || invite.status !== "pending") return { ok: true as const };
  await createAdminClient()
    .from("organizer_invites")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", invite.id);
  return { ok: true as const };
}

/** Email invites waiting for this person (for their dashboard). */
export async function pendingOrganizerInvites(email: string | null | undefined) {
  if (!email) return [];
  const { data, error } = await createAdminClient()
    .from("organizer_invites")
    .select("token, invited_by, tournaments(id, name)")
    .eq("kind", "email")
    .eq("status", "pending")
    .ilike("email", normalizePartnerEmail(email));
  if (error) return [];
  return (data ?? []).map((i) => ({
    token: i.token as string,
    tournamentName: (relationOne(i.tournaments as never) as { name: string } | null)?.name ?? "An event",
  }));
}

export async function removeMember(tournamentId: string, userId: string) {
  const { data: t } = await createAdminClient().from("tournaments").select("owner_id").eq("id", tournamentId).maybeSingle();
  if (t?.owner_id === userId) return { error: "The owner can't be removed." };
  const { error } = await createAdminClient()
    .from("tournament_organizers")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);
  return error ? { error: error.message } : { ok: true as const };
}
