import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { SUPER_ADMIN_ROLE } from "@/lib/auth/is-super-admin";
import { getOrganizerFeePercent } from "@/lib/wallet/fees";

export type OrganizerWalletPolicy = {
  userId: string;
  feePercent: number;
  /** Credit organizer from PayMongo settlement (not gross − fee). */
  creditSettlement: boolean;
  /** 0% + settlement credit via PayMongo wallet instant-settlement net (Neil / super admins). */
  settlementEligible: boolean;
};

export async function loadOrganizerWalletPolicy(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<OrganizerWalletPolicy> {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("profiles")
      .select("platform_fee_percent, wallet_credit_settlement")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const isSuperAdmin = authUser?.user?.app_metadata?.role === SUPER_ADMIN_ROLE;

  if (isSuperAdmin) {
    return {
      userId,
      feePercent: 0,
      creditSettlement: true,
      settlementEligible: true,
    };
  }

  const feePercent = getOrganizerFeePercent(profile);
  const profileSettlement = Boolean(profile?.wallet_credit_settlement);
  const settlementEligible = profileSettlement && feePercent === 0;

  return {
    userId,
    feePercent: settlementEligible ? 0 : feePercent,
    creditSettlement: settlementEligible,
    settlementEligible,
  };
}