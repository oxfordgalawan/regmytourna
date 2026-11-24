"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMinWithdrawalCents } from "@/lib/env/server";
import { sendRegistrationEmail } from "@/lib/email/send";
import { withdrawalReviewedEmail } from "@/lib/email/wallet-email";
import { paymongoWalletConfigured } from "@/lib/services/paymongo/paymongo-env";
import { sendPaymongoWithdrawalPayout } from "@/lib/wallet/paymongo-withdrawal-payout";

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

  let paymongoTransferId: string | null = null;

  if (input.action === "approve") {
    const { data: pending } = await admin
      .from("withdrawal_requests")
      .select("id, amount_cents, status, payout_snapshot, paymongo_transfer_id")
      .eq("id", input.requestId)
      .maybeSingle();

    if (!pending || pending.status !== "pending") {
      return { error: "This request is not pending." };
    }

    if (paymongoWalletConfigured()) {
      if (pending.paymongo_transfer_id) {
        return { error: "This withdrawal already has a PayMongo transfer. Refresh the page." };
      }
      const payout = await sendPaymongoWithdrawalPayout({
        requestId: pending.id,
        amountCents: pending.amount_cents,
        payoutSnapshot: (pending.payout_snapshot ?? {}) as Record<string, unknown>,
      });
      if ("error" in payout && payout.error) {
        return { error: payout.error };
      }
      if (!("transferId" in payout) || !payout.transferId) {
        return { error: "PayMongo payout did not return a transfer id." };
      }
      paymongoTransferId = payout.transferId;
    }
  }

  const { error } = await admin.rpc("review_wallet_withdrawal", {
    p_request_id: input.requestId,
    p_action: input.action,
    p_admin_user_id: adminUser.id,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    return {
      error: error.message.includes("already reviewed")
        ? "This request was already reviewed."
        : paymongoTransferId
          ? `Ledger update failed after PayMongo transfer ${paymongoTransferId}. Contact support before retrying.`
          : "Review failed.",
    };
  }

  if (paymongoTransferId) {
    const refNote = input.note?.trim();
    await admin
      .from("withdrawal_requests")
      .update({
        paymongo_transfer_id: paymongoTransferId,
        admin_note: [refNote, `PayMongo: ${paymongoTransferId}`].filter(Boolean).join(" · ") || null,
      })
      .eq("id", input.requestId);
  }

  // let the organizer know (best effort)
  const { data: req } = await admin
    .from("withdrawal_requests")
    .select("user_id, amount_cents, payout_snapshot, admin_note, paymongo_transfer_id")
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

function nextPaymongoPayoutAttempt(adminNote: string | null) {
  const matches = adminNote?.match(/PayMongo attempt (\d+)/g) ?? [];
  return matches.length + 1;
}

function mergeAdminNote(existing: string | null, transferId: string, attempt: number, refNote?: string) {
  const parts = [existing?.trim(), refNote?.trim(), `PayMongo attempt ${attempt}`, `PayMongo: ${transferId}`].filter(Boolean);
  return parts.join(" · ") || null;
}

/** PayMongo InstaPay for approvals that were marked sent without a transfer (manual approve). */
export async function retryPaymongoWithdrawalPayout(input: {
  requestId: string;
  note?: string;
}): Promise<{ success?: true; error?: string; transferId?: string }> {
  await requireSuperAdmin();
  if (!paymongoWalletConfigured()) {
    return { error: "PayMongo wallet is not configured on the server." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("withdrawal_requests")
    .select("id, status, amount_cents, payout_snapshot, paymongo_transfer_id, admin_note, user_id")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!row) return { error: "Withdrawal not found." };
  if (row.status !== "approved") {
    return { error: "Only approved withdrawals can be retried." };
  }
  if (row.paymongo_transfer_id) {
    return { error: "This withdrawal already has a PayMongo transfer." };
  }

  const attempt = nextPaymongoPayoutAttempt(row.admin_note);
  const payout = await sendPaymongoWithdrawalPayout({
    requestId: row.id,
    amountCents: row.amount_cents,
    payoutSnapshot: (row.payout_snapshot ?? {}) as Record<string, unknown>,
    attempt,
  });

  if ("error" in payout && payout.error) {
    const failNote = [row.admin_note?.trim(), `PayMongo attempt ${attempt} failed: ${payout.error}`]
      .filter(Boolean)
      .join(" · ");
    await admin.from("withdrawal_requests").update({ admin_note: failNote || null }).eq("id", row.id);
    revalidatePath("/super-admin/withdrawals");
    return { error: payout.error };
  }

  if (!("transferId" in payout) || !payout.transferId) {
    return { error: "PayMongo payout did not return a transfer id." };
  }

  const adminNote = mergeAdminNote(row.admin_note, payout.transferId, attempt, input.note?.trim());
  await admin
    .from("withdrawal_requests")
    .update({ paymongo_transfer_id: payout.transferId, admin_note: adminNote })
    .eq("id", row.id);

  const { data: u } = await admin.auth.admin.getUserById(row.user_id);
  if (u?.user?.email) {
    const snap = (row.payout_snapshot ?? {}) as { label?: string };
    const mail = withdrawalReviewedEmail({
      approved: true,
      amountCents: row.amount_cents,
      methodLabel: snap.label ?? "your payout method",
      note: adminNote,
      walletUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/organizer/wallet`,
    });
    await sendRegistrationEmail({ to: u.user.email, ...mail }).catch(() => undefined);
  }

  revalidatePath("/super-admin/withdrawals");
  revalidatePath("/super-admin");
  revalidatePath("/organizer/wallet");
  return { success: true, transferId: payout.transferId };
}
