import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationEmail } from "@/lib/email/send";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { buildBalanceDueEmailHtml } from "@/lib/email/balance-due-email";
import { getFeeDueCents, getRegistrationBalance } from "@/lib/registrations/payment-balance";

export async function notifyRegistrantBalanceDue(
  registrationId: string,
  opts?: { organizerNote?: string | null }
) {
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registrations")
    .select(
      `id, registered_by, tournaments(name, slug, start_date, end_date, venue_name, city, currency, entry_fee_cents),
      tournament_divisions(name, format, entry_fee_cents),
      ${REGISTRATION_PLAYERS_SELECT}`
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration) return { error: "registration_not_found" as const };

  const tournament = relationOne(registration.tournaments) as {
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
    currency: string;
    entry_fee_cents: number;
  } | null;
  const division = relationOne(registration.tournament_divisions) as {
    name: string;
    format: string;
    entry_fee_cents: number | null;
  } | null;
  if (!tournament || !division) return { error: "tournament_not_found" as const };

  const { data: authUser } = await admin.auth.admin.getUserById(registration.registered_by);
  const to = authUser?.user?.email;
  if (!to) return { error: "captain_email_missing" as const };

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", registration.registered_by)
    .maybeSingle();

  const feeDueCents = getFeeDueCents({
    divisionEntryFeeCents: division.entry_fee_cents,
    tournamentEntryFeeCents: tournament.entry_fee_cents,
  });
  const balance = await getRegistrationBalance(admin as never, registrationId, feeDueCents);
  if (balance.balanceDueCents <= 0) return { error: "no_balance_due" as const };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const payUrl = `${appUrl}/entries#entry-${registration.id}`;

  const html = buildBalanceDueEmailHtml({
    playerName: profile?.full_name ?? "Player",
    tournamentName: tournament.name,
    divisionName: division.name,
    format: division.format,
    entryLabel: registrationName(registration),
    feeDueCents,
    paidSoFarCents: balance.paidCents,
    balanceDueCents: balance.balanceDueCents,
    currency: tournament.currency ?? "PHP",
    payUrl,
    organizerNote: opts?.organizerNote?.trim() || null,
  });

  const sent = await sendRegistrationEmail({
    to,
    subject: `Registration fee corrected — ${tournament.name}`,
    html,
  });

  if ("error" in sent && sent.error) {
    console.error("[balance-due-notify]", sent.error);
    return { error: sent.error };
  }

  await admin
    .from("registrations")
    .update({ fee_adjustment_notified_at: new Date().toISOString() })
    .eq("id", registrationId);

  return { ok: true as const };
}