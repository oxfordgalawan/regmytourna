import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import type { Tournament, TournamentDivision } from "@/types/database";

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
    .in("status", [
      "published",
      "registration_open",
      "registration_closed",
      "in_progress",
      "completed",
    ])
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

export async function getTournamentBySlug(slug: string) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase not configured") };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, tournament_divisions(*), profiles:owner_id(full_name)")
    .eq("slug", slug)
    .maybeSingle();
  return { data, error };
}

export { formatPhp } from "@/lib/format";
