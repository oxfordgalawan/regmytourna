"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import type { AccountType } from "@/types/database";

export async function updateProfile(input: { fullName: string; phone: string | null }) {
  const user = await requireUser();
  const supabase = await createClient();

  const fullName = input.fullName.trim();
  if (!fullName) {
    return { error: "Full name is required." };
  }

  const phone = input.phone?.trim() || null;

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  if (!updated) {
    const accountType = (user.user_metadata?.account_type as AccountType | undefined) ?? "player";
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      phone,
      account_type: accountType === "organizer" ? "organizer" : "player",
    });
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/settings");
  return { success: true as const };
}
