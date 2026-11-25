import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import {
  organizerNetFromResolvedSettlement,
  resolveOrganizerSettlementForPayment,
} from "@/lib/payments/resolve-organizer-settlement";
import { loadOrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";
import { relationOne } from "@/lib/supabase/relations";

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
  const { data: registration } = await admin
    .from("registrations")
    .select("tournaments(owner_id)")
    .eq("id", opts.registrationId)
    .maybeSingle();

  const tournament = relationOne(registration?.tournaments as never) as { owner_id: string } | null;
  if (!tournament?.owner_id) return;

  const policy = await loadOrganizerWalletPolicy(admin, tournament.owner_id);
  if (!policy.settlementEligible) return;

  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, amount_cents, paymongo_payment_intent_id, paymongo_checkout_session_id, settlement_cents, paid_at, credited_to_user_id"
    )
    .eq("registration_id", opts.registrationId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return;
  if (payment.credited_to_user_id) return;

  const resolved = await resolveOrganizerSettlementForPayment(
    {
      ...payment,
      paymongo_payment_intent_id:
        opts.intentId?.trim() || payment.paymongo_payment_intent_id,
      paymongo_checkout_session_id:
        opts.sessionId?.trim() || payment.paymongo_checkout_session_id,
    },
    policy
  );

  if (!resolved) return;

  const stored = payment.settlement_cents;
  if (stored !== null && resolved.settlementCents >= stored) return;

  const { organizerNetCents } = organizerNetFromResolvedSettlement(
    resolved.settlementCents,
    payment.amount_cents,
    policy
  );

  await admin
    .from("payments")
    .update({
      settlement_cents: resolved.settlementCents,
      paymongo_fee_cents: resolved.paymongoFeeCents,
      organizer_net_cents: organizerNetCents,
    })
    .eq("id", payment.id);
}