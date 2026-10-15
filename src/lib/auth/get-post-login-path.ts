import type { User } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { sanitizeNext } from "@/lib/auth/safe-next";

export function getPostLoginPath(user: User, next?: string | null): string {
  const safe = sanitizeNext(next);
  if (safe) {
    if (isSuperAdmin(user) && safe.startsWith("/super-admin")) {
      return safe;
    }
    if (!isSuperAdmin(user)) {
      return safe;
    }
  }
  if (isSuperAdmin(user)) {
    return "/super-admin";
  }
  return "/dashboard";
}
