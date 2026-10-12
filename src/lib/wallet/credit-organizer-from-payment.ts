import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { splitPaymentAmount } from "@/lib/wallet/fees";
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

  const { data: payment, error: payError } = await admin
    .from("payments")
    .select("id, amount_cents, status, credited_to_user_id")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payError || !payment) {
    return { credited: false, reason: "payment_not_found" };
  }

  if (payment.credited_to_user_id) {
    return { credited: false, reason: "already_credited" };
  }

  const grossCents = payment.amount_cents;
  const { platformFeeCents, organizerNetCents } = splitPaymentAmount(grossCents);

  const { data: credited, error: rpcError } = await admin.rpc("credit_organizer_wallet", {
    p_user_id: tournament.owner_id,
    p_organizer_net_cents: organizerNetCents,
    p_payment_id: payment.id,
    p_registration_id: registrationId,
    p_tournament_id: registration.tournament_id,
    p_platform_fee_cents: platformFeeCents,
    p_gross_cents: grossCents,
    p_description: `Entry: ${tournament.name}`,
  });

  if (rpcError) {
    console.error("credit_organizer_wallet failed:", rpcError.message);
    return { credited: false, reason: rpcError.message };
  }

  return { credited: credited === true };
}
