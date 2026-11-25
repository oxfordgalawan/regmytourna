import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import {
  organizerNetFromResolvedSettlement,
  resolveOrganizerSettlementForPayment,
} from "@/lib/payments/resolve-organizer-settlement";
import { splitPaymentAmount } from "@/lib/wallet/fees";
import { loadOrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";
import { relationOne } from "@/lib/supabase/relations";

type AdminClient = SupabaseClient<Database>;

export async function creditOrganizerFromRegistration(
  admin: AdminClient,
  registrationId: string
): Promise<{ credited: boolean; reason?: string }> {
  const { data: registration, error: regError } = await admin
    .from("registrations")
    .select("id, tournament_id, tournaments(name, owner_id)")
    .eq("id", registrationId)
    .maybeSingle();

  if (regError || !registration) {
    return { credited: false, reason: "registration_not_found" };
  }

  const tournament = relationOne(registration.tournaments) as {
    name: string;
    owner_id: string;
  } | null;
  if (!tournament?.owner_id) {
    return { credited: false, reason: "tournament_owner_missing" };
  }

  const policy = await loadOrganizerWalletPolicy(admin, tournament.owner_id);

  const { data: payment, error: payError } = await admin
    .from("payments")
    .select(
      "id, amount_cents, status, credited_to_user_id, paymongo_payment_intent_id, paymongo_checkout_session_id, settlement_cents, paymongo_fee_cents, paid_at"
    )
    .eq("registration_id", registrationId)
    .eq("status", "paid")
    .is("credited_to_user_id", null)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payError || !payment) {
    return { credited: false, reason: "payment_not_found" };
  }

  if (payment.credited_to_user_id) {
    return { credited: false, reason: "already_credited" };
  }

  const grossCents = payment.amount_cents;
  const { platformFeeCents } = splitPaymentAmount(grossCents, policy.feePercent);

  let settlementCents: number | null = payment.settlement_cents;
  let paymongoFeeCents: number | null = payment.paymongo_fee_cents;

  if (policy.creditSettlement) {
    const resolved = resolveOrganizerSettlementForPayment(payment, policy);
    if (resolved) {
      settlementCents = resolved.settlementCents;
      paymongoFeeCents = resolved.paymongoFeeCents;
      const { organizerNetCents: resolvedNet } = organizerNetFromResolvedSettlement(
        resolved.settlementCents,
        grossCents,
        policy
      );
      await admin
        .from("payments")
        .update({
          settlement_cents: settlementCents,
          paymongo_fee_cents: paymongoFeeCents,
          organizer_net_cents: resolvedNet,
        })
        .eq("id", payment.id);
    }
  }

  let organizerNetCents: number;
  if (policy.creditSettlement && settlementCents !== null) {
    organizerNetCents = organizerNetFromResolvedSettlement(settlementCents, grossCents, policy).organizerNetCents;
  } else if (policy.creditSettlement && settlementCents === null) {
    console.warn(
      `wallet_credit_settlement: no PayMongo settlement for payment ${payment.id}; falling back to gross − fee`
    );
    organizerNetCents = splitPaymentAmount(grossCents, policy.feePercent).organizerNetCents;
  } else {
    organizerNetCents = splitPaymentAmount(grossCents, policy.feePercent).organizerNetCents;
  }

  const { data: credited, error: rpcError } = await admin.rpc("credit_organizer_wallet", {
    p_user_id: tournament.owner_id,
    p_organizer_net_cents: organizerNetCents,
    p_payment_id: payment.id,
    p_registration_id: registrationId,
    p_tournament_id: registration.tournament_id,
    p_platform_fee_cents: platformFeeCents,
    p_gross_cents: grossCents,
    p_description: `Entry: ${tournament.name}`,
    p_settlement_cents: policy.creditSettlement ? (settlementCents ?? undefined) : undefined,
    p_paymongo_fee_cents: policy.creditSettlement ? (paymongoFeeCents ?? undefined) : undefined,
  });

  if (rpcError) {
    console.error("credit_organizer_wallet failed:", rpcError.message);
    return { credited: false, reason: rpcError.message };
  }

  return { credited: credited === true };
}