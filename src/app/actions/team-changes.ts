"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import {
  acceptSubstitution,
  cancelEntry,
  changePartner,
  createSubstitution,
  declineSubstitution,
  expireSubstitutions,
  isCaptain,
  leaveTeam,
  loadTeam,
  playerGuard,
  sendSubstituteInvite,
  type Team,
} from "@/lib/registrations/team-changes";

type Result = { ok?: true; error?: string };

function refresh(team: Pick<Team, "tournamentId" | "slug">) {
  revalidatePath("/entries");
  revalidatePath("/dashboard");
  if (team.slug) revalidatePath(`/tournaments/${team.slug}`);
  revalidatePath(`/organizer/tournaments/${team.tournamentId}/registrations`);
}

async function guarded(registrationId: string) {
  const user = await requireUser();
  const g = playerGuard(await loadTeam(registrationId), user.id);
  return { user, g };
}

/** Captain: change (or add) the partner right away. */
export async function changeMyPartnerAction(registrationId: string, partner: { name: string; email: string }): Promise<Result> {
  const { user, g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  if (!isCaptain(g.team, user.id)) return { error: "Only the team captain can change partners." };
  const res = await changePartner(g.team, user.id, user.email, partner);
  if (!res.ok) return { error: res.error };
  refresh(g.team);
  return { ok: true };
}

/** Either player: ask someone to take my place. I stay on the team until they accept. */
export async function inviteSubstituteAction(registrationId: string, sub: { name: string; email: string }): Promise<Result> {
  const { user, g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  const res = await createSubstitution(g.team, g.me, { id: user.id, email: user.email }, sub);
  if (!res.ok) return { error: res.error };
  refresh(g.team);
  return { ok: true };
}

export async function resendSubstituteAction(registrationId: string): Promise<Result> {
  const { user, g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  const pending = g.team.pending;
  if (!pending || pending.requested_by !== user.id) return { error: "There's no invite of yours waiting." };
  await sendSubstituteInvite(g.team, g.me, pending);
  return { ok: true };
}

export async function withdrawSubstituteAction(registrationId: string): Promise<Result> {
  const { user, g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  if (!g.team.pending || g.team.pending.requested_by !== user.id) return { error: "There's no invite of yours waiting." };
  await expireSubstitutions(g.team.id, "withdrawn");
  refresh(g.team);
  return { ok: true };
}

/** Either player: leave now. The other keeps the slot and chooses what to do. */
export async function leaveTeamAction(registrationId: string): Promise<Result & { cancelled?: boolean }> {
  const { g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  const res = await leaveTeam(g.team, g.me);
  if (!res.ok) return { error: res.error };
  refresh(g.team);
  return { ok: true, cancelled: res.cancelled };
}

/** Captain: cancel the whole entry and release the slot. */
export async function cancelOurEntryAction(registrationId: string): Promise<Result> {
  const { user, g } = await guarded(registrationId);
  if (!g.ok) return { error: g.error };
  if (!isCaptain(g.team, user.id)) return { error: "Only the team captain can cancel the entry. You can leave the team instead." };
  const res = await cancelEntry(g.team, user.id);
  if (!res.ok) return { error: res.error };
  refresh(g.team);
  return { ok: true };
}

/** The substitute's answer, from /substitute/<token>. */
export async function acceptSubstituteAction(token: string): Promise<Result> {
  const user = await requireUser(`/substitute/${token}`);
  const res = await acceptSubstitution(token, user.id);
  if (!res.ok) return { error: res.error };
  const team = await loadTeam(res.registrationId);
  if (team) refresh(team);
  return { ok: true };
}

export async function declineSubstituteAction(token: string): Promise<Result> {
  const res = await declineSubstitution(token);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}

