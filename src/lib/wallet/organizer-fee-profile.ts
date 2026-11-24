import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { getOrganizerFeePercent } from "@/lib/wallet/fees";

export type OrganizerWalletPolicy = {
  userId: string;
  feePercent: number;
  creditSettlement: boolean;
};

export async function loadOrganizerWalletPolicy(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<OrganizerWalletPolicy> {
  const { data: profile } = await admin
    .from("profiles")
    .select("platform_fee_percent, wallet_credit_settlement")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId,
    feePercent: getOrganizerFeePercent(profile),
    creditSettlement: Boolean(profile?.wallet_credit_settlement),
  };
}