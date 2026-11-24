"use client";

import { isSupabaseConfigured } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/client";

/** Clears browser + server Supabase session, then hard-navigates so nav UI updates. */
export async function performSignOut(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  try {
    const res = await fetch("/api/auth/sign-out", { method: "POST", credentials: "include", cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!res.ok) {
      return { error: body.error ?? "Could not sign out on the server." };
    }
  } catch {
    return { error: "Could not reach the server to sign out." };
  }

  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // cookies already cleared — still go home
  }

  window.location.assign("/");
  return {};
}