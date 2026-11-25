import { resolvePaymongoSettlement } from "@/lib/services/paymongo/paymongo-settlement";
import { splitPaymentAmount } from "@/lib/wallet/fees";
import type { OrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";

export type SettlementPaymentRow = {
  amount_cents: number;
  paymongo_payment_intent_id: string | null;
  paymongo_checkout_session_id: string | null;
  settlement_cents: number | null;
  paid_at: string | null;
};

export async function resolveOrganizerSettlementForPayment(
  payment: SettlementPaymentRow,
  policy: OrganizerWalletPolicy
): Promise<{ settlementCents: number; paymongoFeeCents: number } | null> {
  if (!policy.settlementEligible) return null;

  return resolvePaymongoSettlement({
    intentId: payment.paymongo_payment_intent_id,
    sessionId: payment.paymongo_checkout_session_id,
    grossCents: payment.amount_cents,
    paidAt: payment.paid_at,
    useWalletInstantSettlement: true,
  });
}

export function organizerNetFromResolvedSettlement(
  settlementCents: number,
  grossCents: number,
  policy: OrganizerWalletPolicy
): { organizerNetCents: number; platformFeeCents: number } {
  const { platformFeeCents } = splitPaymentAmount(grossCents, policy.feePercent);
  return {
    platformFeeCents,
    organizerNetCents: Math.max(0, settlementCents - platformFeeCents),
  };
}