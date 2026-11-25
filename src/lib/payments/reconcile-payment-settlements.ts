import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import {
  organizerNetFromResolvedSettlement,
  resolveOrganizerSettlementForPayment,
} from "@/lib/payments/resolve-organizer-settlement";
import type { OrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";

type AdminClient = SupabaseClient<Database>;

const SETTLEMENT_RECONCILE_DESCRIPTION =
  "Fixed 1.495% PayMongo processing: correct settlement on entry";

/** Align stored settlement / credits with the fixed 1.495% PayMongo deduction model. */
export async function reconcileStalePaymentSettlements(
  admin: AdminClient,
  userId: string,
  policy: OrganizerWalletPolicy
) {
  if (!policy.settlementEligible) return;

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await admin.from("tournaments").select("id").eq("owner_id", userId);
  const tournamentIds = (events ?? []).map((t) => t.id);
  if (!tournamentIds.length) return;

  const { data: regs } = await admin
    .from("registrations")
    .select("id")
    .in("tournament_id", tournamentIds);
  const regIds = (regs ?? []).map((r) => r.id);
  if (!regIds.length) return;

  const { data: payments } = await admin
    .from("payments")
    .select(
      "id, registration_id, amount_cents, paymongo_payment_intent_id, paymongo_checkout_session_id, settlement_cents, paymongo_fee_cents, organizer_net_cents, paid_at, credited_to_user_id"
    )
    .in("registration_id", regIds)
    .eq("status", "paid")
    .in("method", ["online", "qr"])
    .gte("paid_at", since)
    .order("paid_at", { ascending: false })
    .limit(120);

  for (const payment of payments ?? []) {
    const resolved = resolveOrganizerSettlementForPayment(payment, policy);
    if (!resolved) continue;

    const stored = payment.settlement_cents;
    if (stored !== null && stored === resolved.settlementCents) continue;

    const { organizerNetCents, platformFeeCents } = organizerNetFromResolvedSettlement(
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

    const { data: entryTx } = await admin
      .from("wallet_transactions")
      .select("id, amount_cents, metadata")
      .eq("payment_id", payment.id)
      .eq("type", "entry_payment")
      .maybeSingle();

    if (entryTx) {
      const meta = (entryTx.metadata ?? {}) as Record<string, unknown>;
      await admin
        .from("wallet_transactions")
        .update({
          amount_cents: organizerNetCents,
          metadata: {
            ...meta,
            organizer_net_cents: organizerNetCents,
            settlement_cents: resolved.settlementCents,
            paymongo_fee_cents: resolved.paymongoFeeCents,
            platform_fee_cents: platformFeeCents,
          },
        })
        .eq("id", entryTx.id);

      const oldNet = payment.organizer_net_cents ?? entryTx.amount_cents;
      const delta = organizerNetCents - oldNet;
      if (delta !== 0 && payment.credited_to_user_id) {
        const { error } = await admin.rpc("adjust_organizer_wallet_balance", {
          p_user_id: payment.credited_to_user_id,
          p_amount_cents: delta,
          p_description: SETTLEMENT_RECONCILE_DESCRIPTION,
          p_admin_user_id: payment.credited_to_user_id,
          p_metadata: {
            settlement_reconcile: true,
            fixed_paymongo_fee_bps: 1495,
            payment_id: payment.id,
            registration_id: payment.registration_id,
            old_organizer_net_cents: oldNet,
            new_organizer_net_cents: organizerNetCents,
            old_settlement_cents: stored,
            new_settlement_cents: resolved.settlementCents,
          },
        });
        if (error) {
          console.warn("reconcile_payment_settlement: balance adjust failed", payment.id, error.message);
        }
      }
    }
  }
}