"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMinWithdrawalCents } from "@/lib/env/server";
import { sendRegistrationEmail } from "@/lib/email/send";
import { withdrawalReviewedEmail } from "@/lib/email/wallet-email";

export async function requestWalletWithdrawal(input: {
  amountCents: number;
  payoutMethodId: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { error: "Enter a valid withdrawal amount." };
  }

  const { data, error } = await supabase.rpc("request_wallet_withdrawal", {
    p_user_id: user.id,
    p_amount_cents: input.amountCents,
    p_payout_method_id: input.payoutMethodId,
    p_min_amount_cents: getMinWithdrawalCents(),
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("insufficient balance")) return { error: "Insufficient available balance." };
    if (msg.includes("minimum")) return { error: "Amount is below the minimum withdrawal." };
    if (msg.includes("payout method")) return { error: "Payout method not found." };
    return { error: "Could not submit withdrawal request. Please try again." };
  }

  revalidatePath("/organizer/wallet");
  return { success: true as const, requestId: data as string };
}

export async function reviewWithdrawalRequest(input: {
  requestId: string;
  action: "approve" | "reject";
  note?: string;
}) {
  const adminUser = await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin.rpc("review_wallet_withdrawal", {
    p_request_id: input.requestId,
    p_action: input.action,
    p_admin_user_id: adminUser.id,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    return { error: error.message.includes("already reviewed") ? "This request was already reviewed." : "Review failed." };
  }

  // let the organizer know (best effort)
  const { data: req } = await admin
    .from("withdrawal_requests")
    .select("user_id, amount_cents, payout_snapshot, admin_note")
    .eq("id", input.requestId)
    .maybeSingle();
  if (req) {
    const { data: u } = await admin.auth.admin.getUserById(req.user_id);
    if (u?.user?.email) {
      const snap = (req.payout_snapshot ?? {}) as { label?: string };
      const mail = withdrawalReviewedEmail({
        approved: input.action === "approve",
        amountCents: req.amount_cents,
        methodLabel: snap.label ?? "your payout method",
        note: req.admin_note,
        walletUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/organizer/wallet`,
      });
      await sendRegistrationEmail({ to: u.user.email, ...mail }).catch(() => undefined);
    }
  }

  revalidatePath("/super-admin/withdrawals");
  revalidatePath("/super-admin");
  revalidatePath("/organizer/wallet");
  return { success: true as const };
}
