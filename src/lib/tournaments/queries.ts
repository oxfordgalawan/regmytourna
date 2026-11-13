import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { isSupabaseConfigured } from "@/lib/env/server";
import type { Tournament, TournamentDivision } from "@/types/database";
import { matchScore } from "@/lib/tournaments/fuzzy";
import { completePastTournaments, manilaToday } from "@/lib/tournaments/auto-complete";

const PUBLIC_STATUSES = [
  "published",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
] as const;

/** Search words, stripped of characters that would break a PostgREST filter. */
function searchWords(search?: string) {
  return (search ?? "")
    .replace(/[,()*%\\:."'[\]{}]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function listPublicTournaments(filters?: {
  search?: string;
  sport?: string;
  city?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  /** only events that haven't happened yet (home page "Upcoming") */
  upcoming?: boolean;
}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, count: 0 };
  }
  await completePastTournaments();
  const supabase = await createClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tournaments")
    .select("*, tournament_divisions(id, name, format, entry_fee_cents)", { count: "exact" })
    .eq("is_public", true)
    .in("status", [...PUBLIC_STATUSES])
    .order("start_date", { ascending: true, nullsFirst: false })
    .range(from, to);

  // every word must appear somewhere (name, city, venue or address), so
  // "bayog open" or "cebu pickleball" find events whatever the word order
  for (const word of searchWords(filters?.search)) {
    query = query.or(
      `name.ilike.%${word}%,city.ilike.%${word}%,venue_name.ilike.%${word}%,venue_address.ilike.%${word}%`
    );
  }
  if (filters?.sport) query = query.eq("sport", filters.sport);
  if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.upcoming) {
    const today = manilaToday();
    query = query
      .neq("status", "completed")
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today}),and(end_date.is.null,start_date.is.null)`);
  }

  const { data, error, count } = await query;
  return { data: (data ?? []) as (Tournament & { tournament_divisions: TournamentDivision[] })[], error, count };
}

/** Public event page — service role read avoids RLS/embed issues; still gated below. */
export async function getTournamentBySlug(slug: string) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase not configured") };
  }

  await completePastTournaments();
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("tournaments")
    .select("*, tournament_divisions(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!row) return { data: null, error: null };

  const listedPublic =
    row.is_public && PUBLIC_STATUSES.includes(row.status as (typeof PUBLIC_STATUSES)[number]);

  if (!listedPublic) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: null };
    const allowed =
      row.owner_id === user.id || (await isOrganizerForTournament(user.id, row.id, user));
    if (!allowed) return { data: null, error: null };
  }

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", row.owner_id)
    .maybeSingle();

  const divisions = (row.tournament_divisions ?? []) as TournamentDivision[];
  divisions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const data = {
    ...row,
    tournament_divisions: divisions,
    profiles: ownerProfile ? { full_name: ownerProfile.full_name } : null,
  };

  return { data, error: null };
}

export { formatPhp } from "@/lib/format";

export type TournamentSuggestion = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  venue_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
};

/**
 * Typo-tolerant search over public events, best match first. Small enough to
 * score in memory; used by the search suggestions and as a "close matches"
 * fallback when the exact search finds nothing.
 */
export async function fuzzySearchTournaments(search: string, limit = 6) {
  if (!isSupabaseConfigured() || !search.trim()) return [] as TournamentSuggestion[];
  await completePastTournaments();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("id, name, slug, city, venue_name, venue_address, status, start_date, end_date, cover_image_url")
    .eq("is_public", true)
    .in("status", [...PUBLIC_STATUSES])
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(500);
  // upcoming / live events edge out finished ones on a tie
  const live = new Set(["registration_open", "in_progress", "published", "registration_closed"]);
  return (data ?? [])
    .map((t) => ({ t, score: matchScore(search, t) + (live.has(t.status) ? 0.02 : 0) }))
    .filter((x) => x.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ t }) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      city: t.city,
      venue_name: t.venue_name,
      status: t.status,
      start_date: t.start_date,
      end_date: t.end_date,
      cover_image_url: t.cover_image_url ?? null,
    })) as TournamentSuggestion[];
}

/** Full public rows (as the event cards need them) for fuzzy matches, best first. */
export async function closeMatchTournaments(search: string, limit = 12) {
  const hits = await fuzzySearchTournaments(search, limit);
  if (!hits.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("*, tournament_divisions(id, name, format, entry_fee_cents)")
    .in(
      "id",
      hits.map((h) => h.id)
    );
  const byId = new Map((data ?? []).map((t) => [t.id as string, t]));
  return hits
    .map((h) => byId.get(h.id))
    .filter(Boolean) as (Tournament & { tournament_divisions: TournamentDivision[] })[];
}
