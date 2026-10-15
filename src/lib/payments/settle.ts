import { createAdminClient } from "@/lib/supabase/admin";
import { isCheckoutSessionPaid } from "@/lib/services/paymongo/paymongo-service";
import { creditOrganizerFromRegistration } from "@/lib/wallet/credit-organizer-from-payment";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";
import { notifyRegistrantAfterRegistration } from "@/lib/registrations/registrant-notify";
import { isPayMongoConfigured } from "@/lib/env/server";

/**
 * One place that turns "PayMongo says it's paid" into: payment marked paid,
 * entry confirmed, organizer wallet credited, and emails sent. Safe to call
 * more than once — the webhook, the success page and the wallet's self-check
 * all use it.
 */
export async function settlePaidCheckout(registrationId: string, sessionId: string | null) {
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("registrations")
    .select("payment_status")
    .eq("id", registrationId)
    .maybeSingle();
  if (!before) return { settled: false };
  const alreadyPaid = before.payment_status === "paid";

  const paidAt = new Date().toISOString();
  // mark only the checkout that was paid (an entry can have several: an
  // abandoned online checkout plus a QR shown at the desk)
  const { data: matched } = sessionId
    ? await admin
        .from("payments")
        .update({ status: "paid", paid_at: paidAt })
        .eq("registration_id", registrationId)
        .eq("paymongo_checkout_session_id", sessionId)
        .neq("status", "paid")
        .select("id")
    : { data: null };
  if (!matched?.length && !alreadyPaid) {
    await admin
      .from("payments")
      .update({ status: "paid", paid_at: paidAt })
      .eq("registration_id", registrationId)
      .eq("status", "pending");
  }
  // other open checkouts for this entry can no longer be used
  await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", registrationId).eq("status", "pending");

  if (!alreadyPaid) {
    await admin
      .from("registrations")
      .update({ status: "confirmed", payment_status: "paid" })
      .eq("id", registrationId);
  }

  // idempotent: credits each payment once
  const credit = await creditOrganizerFromRegistration(admin as never, registrationId);

  if (!alreadyPaid) {
    await notifyRegistrantAfterRegistration(registrationId, { kind: "payment_confirmed" }).catch(() => undefined);
    await notifyPartnerAfterRegistration(registrationId).catch(() => undefined);
  }
  return { settled: true, credited: credit.credited };
}

/** Backup for a missed webhook: if PayMongo says this entry's checkout is paid, settle it. */
export async function verifyAndSettle(registrationId: string) {
  if (!isPayMongoConfigured()) return { settled: false };
  const { data: payments } = await createAdminClient()
    .from("payments")
    .select("paymongo_checkout_session_id, status")
    .eq("registration_id", registrationId)
    .eq("status", "pending")
    .not("paymongo_checkout_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  for (const p of payments ?? []) {
    if (p.paymongo_checkout_session_id && (await isCheckoutSessionPaid(p.paymongo_checkout_session_id))) {
      return settlePaidCheckout(registrationId, p.paymongo_checkout_session_id);
    }
  }
  return { settled: false };
}

/**
 * The organizer's wallet self-check: credits any paid online/QR entry on their
 * events that hasn't reached the wallet yet, and confirms recent checkouts the
 * webhook may have missed.
 */
export async function reconcileOrganizerWallet(userId: string) {
  const admin = createAdminClient();
  const { data: events } = await admin.from("tournaments").select("id").eq("owner_id", userId);
  const ids = (events ?? []).map((t) => t.id);
  if (!ids.length) return;

  const { data: regs } = await admin.from("registrations").select("id, payment_status").in("tournament_id", ids);
  const regIds = (regs ?? []).map((r) => r.id);
  if (!regIds.length) return;

  // 1. paid through PayMongo (online or desk QR) but never credited — cash is excluded: it never reaches the platform
  const { data: uncredited } = await admin
    .from("payments")
    .select("registration_id")
    .in("registration_id", regIds)
    .eq("status", "paid")
    .in("method", ["online", "qr"])
    .is("credited_to_user_id", null)
    .limit(50);
  for (const p of uncredited ?? []) {
    await creditOrganizerFromRegistration(admin as never, p.registration_id);
  }

  // 2. checkouts still "pending" in the last 3 days — ask PayMongo directly (a handful at a time)
  if (!isPayMongoConfigured()) return;
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: open } = await admin
    .from("payments")
    .select("registration_id, paymongo_checkout_session_id")
    .in("registration_id", regIds)
    .eq("status", "pending")
    .not("paymongo_checkout_session_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const p of open ?? []) {
    if (p.paymongo_checkout_session_id && (await isCheckoutSessionPaid(p.paymongo_checkout_session_id))) {
      await settlePaidCheckout(p.registration_id, p.paymongo_checkout_session_id);
    }
  }
}
