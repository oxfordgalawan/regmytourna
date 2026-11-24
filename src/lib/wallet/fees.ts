import { getPlatformFeePercent } from "@/lib/env/server";

export type OrganizerFeeProfile = {
  platform_fee_percent: number | null;
} | null;

export function getOrganizerFeePercent(profile?: OrganizerFeeProfile): number {
  const override = profile?.platform_fee_percent;
  if (override !== null && override !== undefined) {
    return Math.min(100, Math.max(0, override));
  }
  return getPlatformFeePercent();
}

export function splitPaymentAmount(
  grossCents: number,
  feePercent = getPlatformFeePercent()
): {
  platformFeeCents: number;
  organizerNetCents: number;
} {
  if (grossCents <= 0) {
    return { platformFeeCents: 0, organizerNetCents: 0 };
  }
  const platformFeeCents = Math.floor((grossCents * feePercent) / 100);
  const organizerNetCents = grossCents - platformFeeCents;
  return { platformFeeCents, organizerNetCents };
}
