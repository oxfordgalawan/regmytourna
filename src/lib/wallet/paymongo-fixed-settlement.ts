/** PayMongo processing fee for 0% convenience-fee organizers (instant settlement model). */
export const PAYMONGO_PROCESSING_FEE_BPS = 1495;

export function computePaymongoFixedSettlement(grossCents: number): {
  settlementCents: number;
  paymongoFeeCents: number;
  organizerNetCents: number;
} {
  if (grossCents <= 0) {
    return { settlementCents: 0, paymongoFeeCents: 0, organizerNetCents: 0 };
  }
  const paymongoFeeCents = Math.round((grossCents * PAYMONGO_PROCESSING_FEE_BPS) / 100_000);
  const settlementCents = Math.max(0, grossCents - paymongoFeeCents);
  return {
    settlementCents,
    paymongoFeeCents,
    organizerNetCents: settlementCents,
  };
}