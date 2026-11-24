"use client";

import { signOutAction } from "@/app/actions/auth";
import { isSupabaseConfigured } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/client";

/** Clears browser + server Supabase session, then hard-navigates so nav UI updates. */
export async function performSignOut(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const supabase = createClient();
  const { error: clientError } = await supabase.auth.signOut();
  if (clientError) {
    return { error: clientError.message };
  }

  const result = await signOutAction();
  if (result?.error) {
    return { error: result.error };
  }

  window.location.assign("/");
  return {};
}