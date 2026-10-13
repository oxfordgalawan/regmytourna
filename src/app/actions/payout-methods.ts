"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeAccountNumber,
  validatePayoutMethod,
  type PayoutMethodType,
} from "@/lib/payout-methods/config";

const MAX_METHODS = 3;

export async function savePayoutMethod(input: {
  id?: string;
  label: string;
  methodType: PayoutMethodType;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  notes?: string;
  isDefault?: boolean;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const label = input.label.trim();
  const accountName = input.accountName.trim();
  const accountNumber = normalizeAccountNumber(input.methodType, input.accountNumber);
  const bankName = input.bankName?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!label || !accountName) {
    return { error: "Label and account name are required." };
  }

  const validationError = validatePayoutMethod({
    methodType: input.methodType,
    accountNumber,
    bankName: bankName ?? undefined,
  });
  if (validationError) return { error: validationError };

  if (!input.id) {
    const { count } = await supabase
      .from("organizer_payout_methods")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= MAX_METHODS) {
      return { error: `You can save up to ${MAX_METHODS} payout methods.` };
    }
  }

  if (input.isDefault) {
    await supabase
      .from("organizer_payout_methods")
      .update({ is_default: false })
      .eq("user_id", user.id);
  }

  const row = {
    user_id: user.id,
    label,
    method_type: input.methodType,
    account_name: accountName,
    account_number: accountNumber,
    bank_name: bankName,
    notes,
    is_default: Boolean(input.isDefault),
  };

  if (input.id) {
    const { error } = await supabase
      .from("organizer_payout_methods")
      .update(row)
      .eq("id", input.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("organizer_payout_methods").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/organizer/wallet");
  return { success: true as const };
}

export async function deletePayoutMethod(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizer_payout_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/organizer/wallet");
  return { success: true as const };
}
