import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";

type AdminClient = SupabaseClient<Database>;

export type RegistrationBalance = {
  feeDueCents: number;
  paidCents: number;
  balanceDueCents: number;
  fullyPaid: boolean;
};

export function getFeeDueCents(input: {
  divisionEntryFeeCents: number | null | undefined;
  tournamentEntryFeeCents: number | null | undefined;
}): number {
  return input.divisionEntryFeeCents ?? input.tournamentEntryFeeCents ?? 0;
}

export async function sumPaidCents(
  admin: AdminClient,
  registrationId: string
): Promise<number> {
  const { data: rows } = await admin
    .from("payments")
    .select("amount_cents")
    .eq("registration_id", registrationId)
    .eq("status", "paid");

  return (rows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);
}

export function computeRegistrationBalance(
  feeDueCents: number,
  paidCents: number
): RegistrationBalance {
  const balanceDueCents = Math.max(0, feeDueCents - paidCents);
  const fullyPaid =
    feeDueCents <= 0 ? paidCents >= 0 : balanceDueCents === 0 && paidCents >= feeDueCents;
  return { feeDueCents, paidCents, balanceDueCents, fullyPaid };
}

export async function getRegistrationBalance(
  admin: AdminClient,
  registrationId: string,
  feeDueCents: number
): Promise<RegistrationBalance> {
  const paidCents = await sumPaidCents(admin, registrationId);
  return computeRegistrationBalance(feeDueCents, paidCents);
}