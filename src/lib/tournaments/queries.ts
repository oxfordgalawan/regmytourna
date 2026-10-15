import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { isSupabaseConfigured } from "@/lib/env/server";
import type { Tournament, TournamentDivision } from "@/types/database";

const PUBLIC_STATUSES = [
  "published",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
] as const;

export async function listPublicTournaments(filters?: {
  search?: string;
  sport?: string;
  city?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, count: 0 };
  }
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

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,venue_name.ilike.%${filters.search}%`
    );
  }
  if (filters?.sport) query = query.eq("sport", filters.sport);
  if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query;
  return { data: (data ?? []) as (Tournament & { tournament_divisions: TournamentDivision[] })[], error, count };
}

/** Public event page — service role read avoids RLS/embed issues; still gated below. */
export async function getTournamentBySlug(slug: string) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase not configured") };
  }

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
      row.owner_id === user.id || (await isOrganizerForTournament(user.id, row.id));
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
