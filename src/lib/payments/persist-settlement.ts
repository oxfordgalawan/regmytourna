import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { resolvePaymongoSettlement } from "@/lib/services/paymongo/paymongo-settlement";

type AdminClient = SupabaseClient<Database>;

/** Stores PayMongo net settlement on the paid payment row (best-effort). */
export async function persistPaymongoSettlementOnPayment(
  admin: AdminClient,
  opts: {
    registrationId: string;
    sessionId?: string | null;
    intentId?: string | null;
  }
) {
  const { data: payment } = await admin
    .from("payments")
    .select("id, amount_cents, paymongo_payment_intent_id, paymongo_checkout_session_id, settlement_cents")
    .eq("registration_id", opts.registrationId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment || payment.settlement_cents !== null) return;

  const intentId = opts.intentId?.trim() || payment.paymongo_payment_intent_id;
  const sessionId = opts.sessionId?.trim() || payment.paymongo_checkout_session_id;

  const resolved = await resolvePaymongoSettlement({
    intentId,
    sessionId,
    grossCents: payment.amount_cents,
  });

  if (!resolved) return;

  await admin
    .from("payments")
    .update({
      settlement_cents: resolved.settlementCents,
      paymongo_fee_cents: resolved.paymongoFeeCents,
    })
    .eq("id", payment.id);
}