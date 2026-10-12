import type { User } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";

export function getPostLoginPath(user: User, next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (isSuperAdmin(user) && next.startsWith("/super-admin")) {
      return next;
    }
    if (!isSuperAdmin(user)) {
      return next;
    }
  }
  if (isSuperAdmin(user)) {
    return "/super-admin";
  }
  return "/dashboard";
}
