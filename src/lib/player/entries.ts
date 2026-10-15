import { createAdminClient } from "@/lib/supabase/admin";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";

/**
 * Everything a player needs about their own entries: where/when, payment
 * state, partner, their next or live match, and their record so far.
 * Reads with the service role, scoped strictly to the signed-in user's entries
 * (including ones a partner registered them into).
 */

export type PlayerMatch = {
  id: string;
  status: string;
  label: string;
  opponent: string;
  courtName: string | null;
  won: boolean | null;
  gamesFor: number;
  gamesAgainst: number;
};

export type PlayerEntry = {
  id: string;
  status: string;
  paymentStatus: string;
  entrySource: string;
  feeCents: number;
  categoryName: string;
  teamName: string;
  tournament: {
    id: string;
    name: string;
    slug: string;
    startDate: string | null;
    endDate: string | null;
    city: string | null;
    venueName: string | null;
    coverImageUrl: string | null;
    status: string;
  };
  /** true when this user registered the entry (they manage the partner) */
  isRegistrant: boolean;
  /** the other player on a doubles entry, from the viewer's point of view */
  partner: {
    name: string | null;
    email: string | null;
    state: "joined" | "invited" | "declined" | "no_email";
  } | null;
  /** partner can still be changed by the registrant (draw not started) */
  canChangePartner: boolean;
  liveMatch: PlayerMatch | null;
  nextMatch: PlayerMatch | null;
  played: PlayerMatch[];
  wins: number;
  losses: number;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Upcoming = event not over yet; past = finished or cancelled. */
export function isUpcoming(e: PlayerEntry) {
  if (e.status === "cancelled" || e.tournament.status === "completed" || e.tournament.status === "cancelled") return false;
  const last = e.tournament.endDate ?? e.tournament.startDate;
  return !last || last >= today();
}

export async function loadPlayerEntries(userId: string): Promise<PlayerEntry[]> {
  const admin = createAdminClient();

  // entries I registered, plus ones where I'm listed as a player (e.g. partner)
  const [{ data: mine }, { data: asPlayer }] = await Promise.all([
    admin.from("registrations").select("id").eq("registered_by", userId),
    admin.from("registration_players").select("registration_id").eq("user_id", userId),
  ]);
  const ids = [...new Set([...(mine ?? []).map((r) => r.id), ...(asPlayer ?? []).map((r) => r.registration_id)])];
  if (!ids.length) return [];

  const [{ data: regs }, { data: matches }, { data: players }] = await Promise.all([
    admin
      .from("registrations")
      .select(
        `id, status, payment_status, entry_source, created_at, registered_by, ${REGISTRATION_PLAYERS_SELECT}, tournament_divisions(name, entry_fee_cents, bracket_state), tournaments(id, name, slug, start_date, end_date, city, venue_name, cover_image_url, status, entry_fee_cents)`
      )
      .in("id", ids),
    admin
      .from("matches")
      .select(
        "id, status, round_label, match_number, team_a_registration_id, team_b_registration_id, team_a_label, team_b_label, winner_registration_id, games_won_a, games_won_b, is_bye, scheduled_at, courts(name)"
      )
      .or(`team_a_registration_id.in.(${ids.join(",")}),team_b_registration_id.in.(${ids.join(",")})`),
    admin
      .from("registration_players")
      .select("registration_id, user_id, is_primary, guest_name, guest_email, partner_invite_status, profiles(full_name)")
      .in("registration_id", ids),
  ]);

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  return (regs ?? [])
    .map((r) => {
      const t = one(r.tournaments) as {
        id: string;
        name: string;
        slug: string;
        start_date: string | null;
        end_date: string | null;
        city: string | null;
        venue_name: string | null;
        cover_image_url: string | null;
        status: string;
        entry_fee_cents: number;
      } | null;
      const d = one(r.tournament_divisions) as {
        name: string;
        entry_fee_cents: number | null;
        bracket_state: string | null;
      } | null;
      if (!t) return null;

      const own = (matches ?? []).filter(
        (m) => !m.is_bye && (m.team_a_registration_id === r.id || m.team_b_registration_id === r.id)
      );
      const toPlayerMatch = (m: (typeof own)[number]): PlayerMatch => {
        const sideA = m.team_a_registration_id === r.id;
        const decided = m.status === "completed" || m.status === "walkover";
        return {
          id: m.id,
          status: m.status,
          label: m.round_label ?? (m.match_number ? `Match ${m.match_number}` : "Match"),
          opponent: sideA ? m.team_b_label : m.team_a_label,
          courtName: (one(m.courts) as { name: string } | null)?.name ?? null,
          won: decided ? m.winner_registration_id === r.id : null,
          gamesFor: sideA ? m.games_won_a : m.games_won_b,
          gamesAgainst: sideA ? m.games_won_b : m.games_won_a,
        };
      };
      const played = own.filter((m) => m.status === "completed" || m.status === "walkover").map(toPlayerMatch);
      const live = own.find((m) => m.status === "in_progress");
      const next = own
        .filter((m) => m.status === "scheduled" && m.team_a_registration_id && m.team_b_registration_id)
        .sort((x, y) => (x.match_number ?? 0) - (y.match_number ?? 0))[0];

      const isRegistrant = r.registered_by === userId;
      // the teammate: for the registrant it's the non-primary row, for a partner it's the primary
      const mate = (players ?? []).find(
        (p) => p.registration_id === r.id && (isRegistrant ? !p.is_primary : p.user_id !== userId)
      );
      const mateName = (one(mate?.profiles) as { full_name: string | null } | null)?.full_name || mate?.guest_name || null;
      const partner: PlayerEntry["partner"] = mate
        ? {
            name: mateName,
            email: isRegistrant ? mate.guest_email : null,
            state: mate.user_id
              ? "joined"
              : mate.partner_invite_status === "declined"
                ? "declined"
                : mate.guest_email
                  ? "invited"
                  : "no_email",
          }
        : null;

      return {
        id: r.id,
        status: r.status,
        isRegistrant,
        partner,
        canChangePartner:
          isRegistrant &&
          Boolean(mate) &&
          !["cancelled", "refunded"].includes(r.status) &&
          (!d?.bracket_state || d.bracket_state === "not_started"),
        paymentStatus: r.payment_status,
        entrySource: r.entry_source ?? "online",
        feeCents: d?.entry_fee_cents ?? t.entry_fee_cents,
        categoryName: d?.name ?? "Category",
        teamName: registrationName(r),
        tournament: {
          id: t.id,
          name: t.name,
          slug: t.slug,
          startDate: t.start_date,
          endDate: t.end_date,
          city: t.city,
          venueName: t.venue_name,
          coverImageUrl: t.cover_image_url,
          status: t.status,
        },
        liveMatch: live ? toPlayerMatch(live) : null,
        nextMatch: next ? toPlayerMatch(next) : null,
        played,
        wins: played.filter((m) => m.won).length,
        losses: played.filter((m) => m.won === false).length,
      } satisfies PlayerEntry;
    })
    .filter((e): e is PlayerEntry => e !== null)
    .sort((x, y) => (x.tournament.startDate ?? "9999").localeCompare(y.tournament.startDate ?? "9999"));
}
