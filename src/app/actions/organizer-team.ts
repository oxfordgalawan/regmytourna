"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import {
  acceptInvite,
  declineInvite,
  inviteByEmail,
  isMember,
  isOwner,
  removeMember,
  resendInvite,
  revokeInvite,
  setShareLink,
} from "@/lib/organizers/team";

type Result = { ok?: true; error?: string };

async function requireOwner(tournamentId: string) {
  const user = await requireUser();
  if (!(await isOwner(tournamentId, user.id))) throw new Error("Only the event owner can manage co-organizers.");
  return user;
}

function refresh(tournamentId: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/team`);
  revalidatePath("/organizer/tournaments");
  revalidatePath("/dashboard");
}

export async function inviteCoOrganizerAction(tournamentId: string, email: string): Promise<Result> {
  const user = await requireOwner(tournamentId);
  const res = await inviteByEmail(tournamentId, email, user.id);
  if (res.ok) refresh(tournamentId);
  return res;
}

export async function resendCoOrganizerInviteAction(tournamentId: string, inviteId: string): Promise<Result> {
  const user = await requireOwner(tournamentId);
  return resendInvite(tournamentId, inviteId, user.id);
}

export async function cancelCoOrganizerInviteAction(tournamentId: string, inviteId: string): Promise<Result> {
  await requireOwner(tournamentId);
  const res = await revokeInvite(tournamentId, inviteId);
  refresh(tournamentId);
  return res;
}

export async function setInviteLinkAction(tournamentId: string, on: boolean): Promise<Result & { token?: string | null }> {
  const user = await requireOwner(tournamentId);
  const res = await setShareLink(tournamentId, on, user.id);
  refresh(tournamentId);
  return res;
}

export async function removeCoOrganizerAction(tournamentId: string, userId: string): Promise<Result> {
  await requireOwner(tournamentId);
  const res = await removeMember(tournamentId, userId);
  refresh(tournamentId);
  return res;
}

/** A co-organizer steps away from an event. */
export async function leaveEventAction(tournamentId: string): Promise<Result> {
  const user = await requireUser();
  if (await isOwner(tournamentId, user.id)) return { error: "You own this event — it can't be left." };
  if (!(await isMember(tournamentId, user.id))) return { ok: true };
  const res = await removeMember(tournamentId, user.id);
  refresh(tournamentId);
  return res;
}

export async function acceptCoOrganizerInviteAction(token: string): Promise<Result & { tournamentId?: string }> {
  const user = await requireUser(`/join/${token}`);
  const res = await acceptInvite(token, { id: user.id, email: user.email });
  if (res.ok) refresh(res.tournamentId);
  return res;
}

export async function declineCoOrganizerInviteAction(token: string): Promise<Result> {
  await declineInvite(token);
  revalidatePath("/dashboard");
  return { ok: true };
}
