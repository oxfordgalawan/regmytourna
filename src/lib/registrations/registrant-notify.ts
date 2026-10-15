import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationEmail } from "@/lib/email/send";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import {
  buildRegistrationEmailHtml,
  describeRegistrationStatus,
  registrationEmailSubject,
  type RegistrationEmailKind,
} from "@/lib/email/registration-email";

type NotifyOptions = {
  kind?: RegistrationEmailKind;
  checkoutUrl?: string | null;
};

/** Email the registering player with tournament details and payment/entry status. */
export async function notifyRegistrantAfterRegistration(registrationId: string, options: NotifyOptions = {}) {
  const admin = createAdminClient();
  const kind = options.kind ?? "registered";

  const { data: registration } = await admin
    .from("registrations")
    .select(
      `id, status, payment_status, entry_source, registered_by, waitlist_position,
      tournaments(name, slug, start_date, end_date, venue_name, city, currency, entry_fee_cents, allow_walk_in_payment),
      tournament_divisions(name, format, entry_fee_cents),
      ${REGISTRATION_PLAYERS_SELECT}`
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration) return;

  const tournament = relationOne(registration.tournaments) as {
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
    currency: string;
    entry_fee_cents: number;
    allow_walk_in_payment: boolean | null;
  } | null;
  const division = relationOne(registration.tournament_divisions) as {
    name: string;
    format: string;
    entry_fee_cents: number | null;
  } | null;
  if (!tournament || !division) return;

  const { data: authUser } = await admin.auth.admin.getUserById(registration.registered_by);
  const to = authUser?.user?.email;
  if (!to) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", registration.registered_by)
    .maybeSingle();

  const entryLabel = registrationName(registration);
  const players = (registration.registration_players ?? []) as Array<{
    is_primary?: boolean | null;
    guest_name: string | null;
  }>;
  const partner = players.find((p) => !p.is_primary);
  const partnerLine = partner?.guest_name ?? undefined;

  const feeCents = division.entry_fee_cents ?? tournament.entry_fee_cents ?? 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const eventUrl = `${appUrl}/tournaments/${tournament.slug}`;

  const status = describeRegistrationStatus({
    status: registration.status,
    payment_status: registration.payment_status,
    entry_source: registration.entry_source,
    feeCents,
    checkoutUrl: options.checkoutUrl,
  });

  if (kind === "waitlisted") {
    status.statusTitle = registration.waitlist_position
      ? `On the waitlist — #${registration.waitlist_position}`
      : "On the waitlist";
    status.statusDetail =
      "No payment is needed now. If a slot opens, we'll move you in automatically and email you to choose how to pay.";
    status.statusTone = "neutral";
    status.actionUrl = undefined;
    status.actionLabel = undefined;
  }

  if (kind === "promoted") {
    if (feeCents > 0) {
      status.statusTitle = "Slot reserved — choose how to pay";
      status.statusDetail = tournament.allow_walk_in_payment
        ? "Your team is now in the draw list. Pay online now, or choose to pay at the venue on event day (cash or QR)."
        : "Your team is now in the draw list. Pay online to confirm your slot.";
      status.statusTone = "warn";
      status.actionUrl = `${appUrl}/entries#entry-${registration.id}`;
      status.actionLabel = "Choose how to pay";
    } else {
      status.statusTitle = "Confirmed — no payment required";
      status.statusDetail = "You've been moved into the category. See you at the venue.";
      status.statusTone = "good";
      status.actionUrl = undefined;
      status.actionLabel = undefined;
    }
  }

  if (kind === "payment_confirmed") {
    status.statusTitle = "Confirmed — payment received";
    status.statusDetail = "Your entry fee is paid and your slot is confirmed.";
    status.statusTone = "good";
    status.actionUrl = undefined;
    status.actionLabel = undefined;
  }

  const html = buildRegistrationEmailHtml({
    kind,
    playerName: profile?.full_name ?? "Player",
    tournamentName: tournament.name,
    divisionName: division.name,
    format: division.format,
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    venueName: tournament.venue_name,
    city: tournament.city,
    feeCents,
    currency: tournament.currency ?? "PHP",
    entryLabel,
    partnerLine,
    eventUrl,
    ...status,
  });

  const sent = await sendRegistrationEmail({
    to,
    subject: registrationEmailSubject(kind, tournament.name),
    html,
  });

  if ("error" in sent && sent.error) {
    console.error("[registrant-notify]", sent.error);
  }
}
