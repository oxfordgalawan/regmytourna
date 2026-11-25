import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { checkCrossCategoryEligibility } from "@/lib/registrations/cross-category-eligibility";
import { sendManualEntryEmail } from "@/lib/email/send";

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"];
const ORGANIZER_SOURCES = new Set(["desk", "import"]);

type Admin = ReturnType<typeof createAdminClient>;

/** Same email can't join two teams in one category (guest email or linked account). */
export async function assertManualEntryEmailAllowed(
  admin: Admin,
  opts: { divisionId: string; tournamentId: string; email: string; excludeRegistrationId?: string }
): Promise<{ ok: true } | { error: string }> {
  const email = normalizePartnerEmail(opts.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email or leave it blank." };

  const { data: others } = await admin
    .from("registrations")
    .select("id, registered_by, registration_players(user_id)")
    .eq("division_id", opts.divisionId)
    .in("status", ACTIVE);
  const ids = (others ?? [])
    .map((o) => o.id)
    .filter((id) => id !== opts.excludeRegistrationId);
  if (ids.length) {
    const { count } = await admin
      .from("registration_players")
      .select("id", { count: "exact", head: true })
      .in("registration_id", ids)
      .ilike("guest_email", email);
    if ((count ?? 0) > 0) return { error: "That email is already on another team in this category." };
  }

  const { data: userId } = await admin.rpc("auth_user_id_for_email", { p_email: email });
  if (userId) {
    const clash = (others ?? [])
      .filter((r) => r.id !== opts.excludeRegistrationId)
      .some(
        (r) =>
          r.registered_by === userId ||
          ((r.registration_players ?? []) as Array<{ user_id: string | null }>).some((p) => p.user_id === userId)
      );
    if (clash) return { error: "That account is already on another team in this category." };
    const cross = await checkCrossCategoryEligibility(userId, opts.tournamentId, opts.divisionId);
    if (!cross.ok) return { error: cross.error };
  }
  return { ok: true };
}

export async function linkGuestPlayerRow(rowId: string, userId: string): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("registration_players")
    .select(
      "id, user_id, guest_email, guest_name, is_primary, partner_invite_token, registrations!inner(id, status, entry_source, division_id, tournament_id)"
    )
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Player row not found." };
  if (row.user_id) {
    if (row.user_id === userId) return { ok: true };
    return { error: "This entry is already linked to another account." };
  }

  const reg = relationOne(row.registrations) as {
    id: string;
    status: string;
    entry_source: string;
    division_id: string;
    tournament_id: string;
  } | null;
  if (!reg) return { error: "Entry not found." };
  if (!ORGANIZER_SOURCES.has(reg.entry_source)) return { error: "This entry can't be linked this way." };
  if (!ACTIVE.includes(reg.status)) return { error: "This entry is no longer active." };

  const { data: others } = await admin
    .from("registrations")
    .select("id, registered_by, registration_players(user_id)")
    .eq("division_id", reg.division_id)
    .in("status", ACTIVE)
    .neq("id", reg.id);
  const clash = (others ?? []).some(
    (r) =>
      r.registered_by === userId ||
      ((r.registration_players ?? []) as Array<{ user_id: string | null }>).some((p) => p.user_id === userId)
  );
  if (clash) return { error: "That account is already on another team in this category." };

  const cross = await checkCrossCategoryEligibility(userId, reg.tournament_id, reg.division_id);
  if (!cross.ok) return { error: cross.error };

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const { error } = await admin
    .from("registration_players")
    .update({
      user_id: userId,
      partner_invite_token: null,
      partner_invite_status: null,
      partner_responded_at: null,
      ...(row.guest_name ? {} : { guest_name: profile?.full_name ?? null }),
    })
    .eq("id", rowId);
  if (error) return { error: error.message };
  await admin.from("profiles").update({ player_enabled: true }).eq("id", userId);
  return { ok: true };
}

/** Links every unlinked organizer-added guest row for this email (login/signup). */
export async function linkOrganizerGuestEntriesByEmail(userId: string, rawEmail: string | null | undefined) {
  if (!rawEmail) return;
  const email = normalizePartnerEmail(rawEmail);
  const admin = createAdminClient();
  const { data: matches } = await admin
    .from("registration_players")
    .select("id, registrations!inner(status, entry_source)")
    .ilike("guest_email", email)
    .is("user_id", null);

  for (const row of matches ?? []) {
    const reg = relationOne(row.registrations) as { status: string; entry_source: string } | null;
    if (!reg || !ORGANIZER_SOURCES.has(reg.entry_source) || !ACTIVE.includes(reg.status)) continue;
    await linkGuestPlayerRow(row.id, userId).catch(() => undefined);
  }
}

/** After manual add: email when no account yet (reuses partner_notified_at for idempotency). */
export async function notifyManualEntryPlayer(rowId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("registration_players")
    .select(
      "id, guest_name, guest_email, user_id, partner_notified_at, registrations!inner(tournament_id, tournaments(name, slug, start_date, end_date, venue_name, city), tournament_divisions(name))"
    )
    .eq("id", rowId)
    .maybeSingle();
  if (!row?.guest_email || row.user_id || row.partner_notified_at) return { skipped: true as const };

  const reg = relationOne(row.registrations) as {
    tournaments: unknown;
    tournament_divisions: unknown;
  } | null;
  const tournament = relationOne(reg?.tournaments as never) as {
    name: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
    venue_name: string | null;
    city: string | null;
  } | null;
  const division = relationOne(reg?.tournament_divisions as never) as { name: string } | null;
  if (!tournament) return { error: "Tournament not found." };

  const email = normalizePartnerEmail(row.guest_email);
  const { data: existingUserId } = await admin.rpc("auth_user_id_for_email", { p_email: email });
  if (existingUserId) return { skipped: true as const };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const venue = [tournament.venue_name, tournament.city].filter(Boolean).join(", ") || null;
  const signUpUrl = `${appUrl}/signup?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/entries")}`;
  const logInUrl = `${appUrl}/login?next=${encodeURIComponent("/entries")}`;

  const sent = await sendManualEntryEmail({
    to: email,
    playerName: row.guest_name,
    tournamentName: tournament.name,
    categoryName: division?.name ?? "your category",
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    venue,
    hasAccount: false,
    signUpUrl,
    logInUrl,
    eventUrl: `${appUrl}/tournaments/${tournament.slug}`,
  });
  if ("error" in sent && sent.error) return { error: sent.error };

  await admin.from("registration_players").update({ partner_notified_at: new Date().toISOString() }).eq("id", rowId);
  return { ok: true as const };
}