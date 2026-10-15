"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { getAppUrl, isResendConfigured, isSupabaseConfigured } from "@/lib/env/server";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { getPostLoginPath } from "@/lib/auth/get-post-login-path";
import { sanitizeNext } from "@/lib/auth/safe-next";
import { findInviteByToken, linkPartner } from "@/lib/registrations/partner-invites";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { acceptSubstitution, findSubstitution } from "@/lib/registrations/team-changes";

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

    // signed up from a partner invite: the link token plus the matching email is the proof
    const token = String(formData.get("invite") ?? "");
    // (an empty identities list means the email already had an account — not a new signup)
    if (token && data.user.identities?.length !== 0) {
      const invite = await findInviteByToken(token);
      if (
        invite?.partnerEmail &&
        normalizePartnerEmail(invite.partnerEmail) === normalizePartnerEmail(email) &&
        invite.status === "pending" &&
        !invite.linkedUserId
      ) {
        await linkPartner(invite, data.user.id).catch(() => undefined);
      }
    }

    // signed up from a "take my place" invite with the same email: they're in
    const subToken = String(formData.get("substitute") ?? "");
    if (subToken && data.user.identities?.length !== 0) {
      const found = await findSubstitution(subToken);
      if (found?.sub.status === "pending" && normalizePartnerEmail(found.sub.substitute_email) === normalizePartnerEmail(email)) {
        await acceptSubstitution(subToken, data.user.id).catch(() => undefined);
      }
    }
  }

  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const user = data.user;
  if (!user) redirect("/dashboard?welcome=1");
  const dest = getPostLoginPath(user, next);
  redirect(dest === "/dashboard" ? "/dashboard?welcome=1" : dest);
}

function passwordResetRedirectUrl(): string {
  const appUrl = getAppUrl().replace(/\/$/, "");
  return `${appUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
}

const PASSWORD_RESET_ACK =
  "If an account exists for that email, we sent a link to reset your password.";

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Enter a valid email address." };
  }
  const email = parsed.data.email.toLowerCase();
  const redirectTo = passwordResetRedirectUrl();

  if (isResendConfigured()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) {
      console.warn("[auth] recovery generateLink:", error.message);
      return { success: true, message: PASSWORD_RESET_ACK };
    }
    const resetUrl = data.properties?.action_link;
    if (!resetUrl) {
      return { success: true, message: PASSWORD_RESET_ACK };
    }
    const sent = await sendPasswordResetEmail({ to: email, resetUrl });
    if ("error" in sent && sent.error) {
      return { error: "Could not send the reset email. Try again in a few minutes." };
    }
    if (sent.skipped) {
      const supabase = await createClient();
      const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (fallbackError) {
        console.warn("[auth] resetPasswordForEmail:", fallbackError.message);
      }
    }
    return { success: true, message: PASSWORD_RESET_ACK };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.warn("[auth] resetPasswordForEmail:", error.message);
  }
  return { success: true, message: PASSWORD_RESET_ACK };
}

export async function updatePassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Check your password and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/login?message=password_updated");
}

/** Clears Supabase auth cookies on the server (client-only signOut often leaves session cookies). */
export async function signOutAction() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };
  redirect("/");
}
