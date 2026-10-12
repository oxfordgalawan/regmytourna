"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { getPostLoginPath } from "@/lib/auth/get-post-login-path";

// Platform role (super_admin) is set only via service role — never via signup.

export async function signInWithPassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. See README for setup." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const user = data.user;
  if (!user) return { error: "Sign in failed" };
  redirect(getPostLoginPath(user, next === "/dashboard" ? null : next));
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. See README for setup." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const accountType = String(formData.get("accountType") ?? "player");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: accountType === "organizer" ? "organizer" : "player",
      },
    },
  });
  if (error) return { error: error.message };

  if (data.user) {
    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        account_type: accountType === "organizer" ? "organizer" : "player",
      })
      .eq("id", data.user.id);
  }

  redirect("/dashboard?welcome=1");
}

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const email = String(formData.get("email") ?? "");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
