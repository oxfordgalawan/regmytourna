"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createClient } from "@/lib/supabase/server";

function revalidateCourts(tournamentId: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/courts`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/scoring`);
  revalidatePath(`/display/${tournamentId}`);
}

async function requireOrganizer(tournamentId: string) {
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId))) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function addCourtAction(tournamentId: string, name: string) {
  await requireOrganizer(tournamentId);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Court name is required." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const { error } = await supabase.from("courts").insert({
    tournament_id: tournamentId,
    name: trimmed,
    sort_order: count ?? 0,
    active: true,
  });
  if (error) {
    if (error.code === "23505") return { error: "A court with that name already exists." };
    return { error: error.message };
  }
  revalidateCourts(tournamentId);
  return { ok: true };
}

/** @deprecated Use addCourtAction(tournamentId, name) from the courts modal. */
export async function addCourtFormAction(tournamentId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  await addCourtAction(tournamentId, name);
}

export async function updateCourtAction(tournamentId: string, courtId: string, name: string) {
  await requireOrganizer(tournamentId);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Court name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ name: trimmed })
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);
  if (error) {
    if (error.code === "23505") return { error: "A court with that name already exists." };
    return { error: error.message };
  }
  revalidateCourts(tournamentId);
  revalidatePath(`/court/${courtId}`);
  return { ok: true };
}

export async function setCourtActiveAction(tournamentId: string, courtId: string, active: boolean) {
  await requireOrganizer(tournamentId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ active })
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateCourts(tournamentId);
  revalidatePath(`/court/${courtId}`);
  return { ok: true };
}

export async function deleteCourtAction(tournamentId: string, courtId: string) {
  await requireOrganizer(tournamentId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .delete()
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);
  if (error) return { error: error.message };
  revalidateCourts(tournamentId);
  return { ok: true };
}

