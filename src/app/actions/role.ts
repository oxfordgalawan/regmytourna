"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoles, type AppRole } from "@/lib/auth/role";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";

/** Switches on a second role. The user keeps the one they had. */
export async function enableRoleAction(role: AppRole): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const { error } = await createAdminClient()
    .from("profiles")
    .update(role === "organizer" ? { organizer_enabled: true } : { player_enabled: true })
    .eq("id", user.id);
  if (error) {
    return {
      error: error.message.includes("column")
        ? "Roles aren't set up yet — run the latest database migration."
        : error.message,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** True when an organizer account has not enabled player access yet (e.g. before entering a event). */
export async function needsPlayerRoleForRegistrationAction() {
  const user = await requireUser();
  const roles = await getRoles(user.id, { superAdmin: isSuperAdmin(user) });
  return { needsPlayerRole: roles.organizer && !roles.player };
}

/** "Start organizing" from the profile page: turn organizer on and create a first event. */
export async function becomeOrganizerAction() {
  const res = await enableRoleAction("organizer");
  if (res.error) return res;
  redirect("/organizer/tournaments/new");
}
