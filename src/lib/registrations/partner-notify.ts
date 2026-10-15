import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerAddedEmail } from "@/lib/email/send";
import { relationOne } from "@/lib/supabase/relations";

/** Idempotent: email partner once after registration is complete. */
export async function notifyPartnerAfterRegistration(registrationId: string) {
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, registered_by, tournaments(name, slug), tournament_divisions(name)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!registration) return;

  const tournament = relationOne(registration.tournaments) as { name: string; slug: string } | null;
  const division = relationOne(registration.tournament_divisions) as { name: string } | null;
  if (!tournament) return;

  const { data: partnerRows } = await admin
    .from("registration_players")
    .select("id, guest_email, guest_name, partner_invite_token, partner_notified_at")
    .eq("registration_id", registrationId)
    .eq("is_primary", false)
    .not("guest_email", "is", null);

  const partner = partnerRows?.find((p) => p.guest_email && !p.partner_notified_at);
  if (!partner?.guest_email) return;

  const { data: primaryProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", registration.registered_by)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const eventUrl = `${appUrl}/tournaments/${tournament.slug}`;
  const inviteUrl = partner.partner_invite_token
    ? `${eventUrl}?partner=${partner.partner_invite_token}`
    : undefined;

  const sent = await sendPartnerAddedEmail({
    to: partner.guest_email,
    tournamentName: tournament.name,
    divisionName: division?.name ?? "your category",
    primaryName: primaryProfile?.full_name ?? "Your partner",
    partnerName: partner.guest_name ?? undefined,
    eventUrl,
    inviteUrl,
  });

  if ("error" in sent && sent.error) {
    console.error("[partner-notify]", sent.error);
    return;
  }
  if ("skipped" in sent && sent.skipped) return;

  await admin
    .from("registration_players")
    .update({ partner_notified_at: new Date().toISOString() })
    .eq("id", partner.id);
}
