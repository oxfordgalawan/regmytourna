import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationEmail } from "@/lib/email/send";
import { organizerEntryEmail } from "@/lib/email/organizer-registration-email";
import { listOrganizerInboxEmails } from "@/lib/organizers/organizer-emails";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { relationOne } from "@/lib/supabase/relations";
import { getAppUrl } from "@/lib/env/server";

const HOLDING_STATUSES = new Set(["confirmed", "awaiting_partner"]);

/** Email event owner + co-organizers when an entry is paid/confirmed (not bulk import). */
export async function notifyOrganizersEntryConfirmed(registrationId: string) {
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registrations")
    .select(
      `id, tournament_id, status, payment_status, entry_source,
      tournaments(id, name, start_date, end_date, venue_name, city, currency, entry_fee_cents),
      tournament_divisions(name, format, entry_fee_cents),
      ${REGISTRATION_PLAYERS_SELECT}`
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration) return;

  if (registration.entry_source === "import") return;
  if (registration.payment_status !== "paid") return;
  if (!HOLDING_STATUSES.has(registration.status)) return;

  const tournament = relationOne(registration.tournaments) as {
    id: string;
    name: string;
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
  if (!tournament || !division) return;

  const recipients = await listOrganizerInboxEmails(registration.tournament_id);
  if (!recipients.length) return;

  const feeCents = division.entry_fee_cents ?? tournament.entry_fee_cents ?? 0;

  const { data: payment } = await admin
    .from("payments")
    .select("method")
    .eq("registration_id", registrationId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const methodRaw = payment?.method as string | undefined;
  const paymentMethod: "online" | "qr" | "cash" | "free" =
    feeCents <= 0
      ? "free"
      : methodRaw === "qr"
        ? "qr"
        : methodRaw === "cash"
          ? "cash"
          : methodRaw === "online"
            ? "online"
            : feeCents > 0
              ? "online"
              : "free";

  const registrationsUrl = `${getAppUrl()}/organizer/tournaments/${tournament.id}/registrations`;
  const { subject, html } = organizerEntryEmail({
    tournamentName: tournament.name,
    tournamentId: tournament.id,
    divisionName: division.name,
    format: division.format,
    entryLabel: registrationName(registration),
    feeCents,
    currency: tournament.currency ?? "PHP",
    paymentMethod,
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    venueName: tournament.venue_name,
    city: tournament.city,
    registrationsUrl,
  });

  const results = await Promise.all(
    recipients.map((to) => sendRegistrationEmail({ to, subject, html }))
  );
  for (const sent of results) {
    if (sent && "error" in sent && sent.error) {
      console.error("[organizer-entry-notify]", sent.error);
    }
  }
}