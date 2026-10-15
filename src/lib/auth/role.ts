import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRole = "player" | "organizer";

/** Cookie set by /view/<role> — which of a user's roles to show right now. */
export const VIEW_COOKIE = "rmt_view";

export type Roles = {
  /** the role they signed up with — their default view */
  primary: AppRole;
  player: boolean;
  organizer: boolean;
};

/**
 * Which roles a user has switched on. Before the dual-role migration runs the
 * flags don't exist, so fall back to the signup role (and tournament ownership).
 */
export async function getRoles(userId: string, opts: { superAdmin?: boolean } = {}): Promise<Roles> {
  const admin = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("tournaments").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);
  const primary: AppRole = profile?.account_type === "organizer" ? "organizer" : "player";
  // super admins can look at (and help with) both sides of the app
  if (opts.superAdmin) return { primary, player: true, organizer: true };
  return {
    primary,
    player: Boolean(profile?.player_enabled) || primary === "player",
    // owning an event always means organizer access, so nobody gets locked out
    organizer: Boolean(profile?.organizer_enabled) || primary === "organizer" || (count ?? 0) > 0,
  };
}

/** Permission check for organizer tools. */
export async function getAppRole(userId: string, opts: { superAdmin?: boolean } = {}): Promise<AppRole> {
  return (await getRoles(userId, opts)).organizer ? "organizer" : "player";
}

/**
 * Which experience to show: the role picked with the switch (if they have
 * it), otherwise the role they signed up with.
 */
export async function getViewRole(
  userId: string,
  opts: { superAdmin?: boolean } = {}
): Promise<{ view: AppRole; role: AppRole; roles: Roles }> {
  const roles = await getRoles(userId, opts);
  const wanted = (await cookies()).get(VIEW_COOKIE)?.value;
  const view: AppRole =
    wanted === "player" && roles.player
      ? "player"
      : wanted === "organizer" && roles.organizer
        ? "organizer"
        : roles.primary === "organizer" && roles.organizer
          ? "organizer"
          : "player";
  return { view, role: roles.organizer ? "organizer" : "player", roles };
}
