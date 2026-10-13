import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { normalizePlaceSearchQuery } from "@/lib/places/normalize";

export type PlaceSearchResult = {
  id: string;
  level: Database["public"]["Enums"]["ph_place_level"];
  label: string;
  name: string;
  regionCode: string;
  regionName: string;
  provinceCode: string | null;
  provinceName: string | null;
  cityMunicipalityCode: string;
  cityMunicipalityName: string;
  barangayCode: string | null;
  barangayName: string | null;
};

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

function rankPlace(row: PlaceSearchResult, tokens: string[]): number {
  const text = row.label.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (text.includes(t)) score += 10;
    if (row.name.toLowerCase().startsWith(t)) score += 8;
    if (row.cityMunicipalityName.toLowerCase().startsWith(t)) score += 6;
  }
  if (row.level === "city_municipality") score += 3;
  return score;
}

export async function searchPhPlaces(
  supabase: SupabaseClient<Database>,
  rawQuery: string,
  limit: number
): Promise<PlaceSearchResult[]> {
  const q = normalizePlaceSearchQuery(rawQuery);
  if (q.length < 2) return [];

  const tokens = q.split(" ").filter((t) => t.length >= 2);
  const primary = tokens[0] ?? q;

  const { data, error } = await supabase
    .from("ph_places")
    .select(
      "psgc_code, level, name, display_label, region_code, region_name, province_code, province_name, city_municipality_code, city_municipality_name, barangay_code, barangay_name, search_text"
    )
    .ilike("search_text", `%${escapeIlike(primary)}%`)
    .limit(Math.min(Math.max(limit * 4, 40), 100));

  if (error || !data) return [];

  const mapped: PlaceSearchResult[] = data.map((row) => ({
    id: row.psgc_code,
    level: row.level,
    label: row.display_label,
    name: row.name,
    regionCode: row.region_code,
    regionName: row.region_name,
    provinceCode: row.province_code,
    provinceName: row.province_name,
    cityMunicipalityCode: row.city_municipality_code,
    cityMunicipalityName: row.city_municipality_name,
    barangayCode: row.barangay_code,
    barangayName: row.barangay_name,
  }));

  const filtered = mapped.filter((row) => {
    const hay = row.label.toLowerCase() + " " + (data.find((d) => d.psgc_code === row.id)?.search_text ?? "");
    return tokens.every((t) => hay.includes(t));
  });

  return filtered
    .sort((a, b) => rankPlace(b, tokens) - rankPlace(a, tokens))
    .slice(0, limit);
}
