"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { getPostLoginPath } from "@/lib/auth/get-post-login-path";
import { sanitizeNext } from "@/lib/auth/safe-next";

// Platform role (super_admin) is set only via service role — never via signup.

export async function signInWithPassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. See README for setup." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const user = data.user;
  if (!user) return { error: "Sign in failed" };
  redirect(getPostLoginPath(user, next));
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. See README for setup." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const accountType = String(formData.get("accountType") ?? "player");
  const placePsgcCode = String(formData.get("placePsgcCode") ?? "").trim();
  const placeLabel = String(formData.get("placeLabel") ?? "").trim();

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
    const profileUpdate: {
      full_name: string;
      account_type: "player" | "organizer";
      place_psgc_code?: string | null;
      place_label?: string | null;
    } = {
      full_name: fullName,
      account_type: accountType === "organizer" ? "organizer" : "player",
    };

    if (placePsgcCode) {
      const { data: placeRow } = await supabase
        .from("ph_places")
        .select("psgc_code, display_label")
        .eq("psgc_code", placePsgcCode)
        .maybeSingle();
      if (!placeRow) {
        return { error: "Selected location is invalid. Please pick from the suggestions." };
      }
      profileUpdate.place_psgc_code = placeRow.psgc_code;
      profileUpdate.place_label = placeLabel || placeRow.display_label;
    }

    await supabase.from("profiles").update(profileUpdate).eq("id", data.user.id);
  }

  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const user = data.user;
  if (!user) redirect("/dashboard?welcome=1");
  const dest = getPostLoginPath(user, next);
  redirect(dest === "/dashboard" ? "/dashboard?welcome=1" : dest);
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
