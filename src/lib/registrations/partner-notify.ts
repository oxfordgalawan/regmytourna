import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerAddedEmail } from "@/lib/email/send";
import { relationOne } from "@/lib/supabase/relations";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";

/**
 * Idempotent: emails the partner once after registration is complete.
 * Pass `force` to resend (e.g. "Resend invite" or after the partner email changed).
 */
export async function notifyPartnerAfterRegistration(registrationId: string, opts: { force?: boolean } = {}) {
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, registered_by, tournaments(name, slug, start_date, end_date, venue_name, city), tournament_divisions(name)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!registration) return { error: "Entry not found." };

  const tournament = relationOne(registration.tournaments) as {
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
  } | null;
  const division = relationOne(registration.tournament_divisions) as { name: string } | null;
  if (!tournament) return { error: "Tournament not found." };

  const { data: partnerRows } = await admin
    .from("registration_players")
    .select("id, guest_email, guest_name, user_id, partner_invite_status, partner_invite_token, partner_notified_at")
    .eq("registration_id", registrationId)
    .eq("is_primary", false)
    .not("guest_email", "is", null);

  const partner = partnerRows?.find(
    (p) =>
      p.guest_email &&
      p.partner_invite_token &&
      p.partner_invite_status !== "declined" &&
      (opts.force || !p.partner_notified_at)
  );
  if (!partner?.guest_email || !partner.partner_invite_token) return { skipped: true };

  const [{ data: primaryProfile }, { data: existingUserId }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", registration.registered_by).maybeSingle(),
    admin.rpc("auth_user_id_for_email", { p_email: normalizePartnerEmail(partner.guest_email) }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const venue = [tournament.venue_name, tournament.city].filter(Boolean).join(", ") || null;

  const sent = await sendPartnerAddedEmail({
    to: partner.guest_email,
    partnerName: partner.guest_name,
    registrantName: primaryProfile?.full_name || "Your partner",
    tournamentName: tournament.name,
    categoryName: division?.name ?? "your category",
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    venue,
    hasAccount: Boolean(existingUserId || partner.user_id),
    inviteUrl: `${appUrl}/invite/${partner.partner_invite_token}`,
    eventUrl: `${appUrl}/tournaments/${tournament.slug}#entries`,
  });

  if ("error" in sent && sent.error) {
    console.error("[partner-notify]", sent.error);
    return { error: "Couldn't send the email. Try again in a moment." };
  }
  if ("skipped" in sent && sent.skipped) return { skipped: true };

  await admin
    .from("registration_players")
    .update({ partner_notified_at: new Date().toISOString() })
    .eq("id", partner.id);
  return { ok: true as const };
}
