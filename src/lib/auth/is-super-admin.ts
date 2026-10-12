import type { User } from "@supabase/supabase-js";

export const SUPER_ADMIN_ROLE = "super_admin";

export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = user.app_metadata?.role;
  return role === SUPER_ADMIN_ROLE;
}
