"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import type { AccountType } from "@/types/database";

export async function updateProfile(input: {
  fullName: string;
  phone: string | null;
  placePsgcCode?: string | null;
  placeLabel?: string | null;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const fullName = input.fullName.trim();
  if (!fullName) {
    return { error: "Full name is required." };
  }

  const phone = input.phone?.trim() || null;

  let placePsgcCode: string | null = null;
  let placeLabel: string | null = null;
  const rawCode = input.placePsgcCode?.trim();
  if (rawCode) {
    const { data: placeRow } = await supabase
      .from("ph_places")
      .select("psgc_code, display_label")
      .eq("psgc_code", rawCode)
      .maybeSingle();
    if (!placeRow) {
      return { error: "Selected location is invalid. Please pick from the suggestions." };
    }
    placePsgcCode = placeRow.psgc_code;
    placeLabel = input.placeLabel?.trim() || placeRow.display_label;
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      place_psgc_code: placePsgcCode,
      place_label: placeLabel,
    })
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
      place_psgc_code: placePsgcCode,
      place_label: placeLabel,
      account_type: accountType === "organizer" ? "organizer" : "player",
    });
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/settings");
  return { success: true as const };
}
