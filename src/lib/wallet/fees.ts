import { getPlatformFeePercent } from "@/lib/env/server";

export function splitPaymentAmount(grossCents: number): {
  platformFeeCents: number;
  organizerNetCents: number;
} {
  if (grossCents <= 0) {
    return { platformFeeCents: 0, organizerNetCents: 0 };
  }
  const percent = getPlatformFeePercent();
  const platformFeeCents = Math.floor((grossCents * percent) / 100);
  const organizerNetCents = grossCents - platformFeeCents;
  return { platformFeeCents, organizerNetCents };
}
