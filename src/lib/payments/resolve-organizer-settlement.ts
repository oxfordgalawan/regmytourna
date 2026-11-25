import { splitPaymentAmount } from "@/lib/wallet/fees";
import { computePaymongoFixedSettlement } from "@/lib/wallet/paymongo-fixed-settlement";
import type { OrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";

export type SettlementPaymentRow = {
  amount_cents: number;
  paymongo_payment_intent_id?: string | null;
  paymongo_checkout_session_id?: string | null;
  settlement_cents?: number | null;
  paid_at?: string | null;
};

export function resolveOrganizerSettlementForPayment(
  payment: SettlementPaymentRow,
  policy: OrganizerWalletPolicy
): { settlementCents: number; paymongoFeeCents: number } | null {
  if (!policy.settlementEligible) return null;
  const { settlementCents, paymongoFeeCents } = computePaymongoFixedSettlement(payment.amount_cents);
  return { settlementCents, paymongoFeeCents };
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