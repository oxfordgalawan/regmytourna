import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { requireUser } from "@/lib/auth/require-user";
import type { User } from "@supabase/supabase-js";

export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();
  const supabase = await createClient();
  const {
    data: { user: freshUser },
  } = await supabase.auth.getUser();
  const effective = freshUser ?? user;
  if (!isSuperAdmin(effective)) {
    redirect("/dashboard?error=super_admin_required");
  }
  return effective;
}
