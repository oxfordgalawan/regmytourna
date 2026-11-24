import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";

type AdminClient = SupabaseClient<Database>;

export async function reverseOrganizerWalletOnRemoval(
  admin: AdminClient,
  registrationId: string,
  tournamentOwnerId: string,
  tournamentId: string,
  tournamentName: string
): Promise<{ reversed: boolean; error?: string }> {
  const { data: payment, error: payError } = await admin
    .from("payments")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payError) return { reversed: false, error: payError.message };
  if (!payment) return { reversed: false };

  const { data, error: rpcError } = await admin.rpc("reverse_payment_on_entry_removal", {
    p_user_id: tournamentOwnerId,
    p_payment_id: payment.id,
    p_registration_id: registrationId,
    p_tournament_id: tournamentId,
    p_description: `Removed entry: ${tournamentName}`,
  });

  if (rpcError) return { reversed: false, error: rpcError.message };
  return { reversed: data === true };
}