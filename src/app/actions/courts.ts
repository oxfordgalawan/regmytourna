"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createClient } from "@/lib/supabase/server";

export async function addCourtAction(tournamentId: string, formData: FormData) {
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId))) {
    throw new Error("Unauthorized");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("courts").insert({ tournament_id: tournamentId, name });
  revalidatePath(`/organizer/tournaments/${tournamentId}/courts`);
}
