import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPhPlaces } from "@/lib/places/search";
import { normalize } from "@/lib/tournaments/fuzzy";

export type CitySuggestion = { name: string; province: string | null; events: number };

const PUBLIC_STATUSES = ["published", "registration_open", "registration_closed", "in_progress", "completed"];

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** "CEBU CITY (Capital)" → "Cebu City", "CITY OF PANABO" → "Panabo City". */
function cleanCity(raw: string) {
  const s = raw.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const m = s.match(/^city of (.+)$/i);
  return titleCase(m ? `${m[1]} City` : s);
}

/** Names starting with the typed text first, then shorter names. */
function rank(name: string, typed: string) {
  const n = normalize(name);
  return (n.startsWith(typed) ? 0 : 100) + n.length;
}

/**
 * City suggestions for the event filter: cities that have events first (with
 * a count), then other Philippine cities/municipalities that match.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const term = q.replace(/[%_,()\\]/g, " ").trim();

  const supabase = await createClient();
  const [{ data: rows }, places] = await Promise.all([
    supabase
      .from("tournaments")
      .select("city")
      .eq("is_public", true)
      .in("status", PUBLIC_STATUSES)
      .ilike("city", `%${term}%`)
      .limit(300),
    searchPhPlaces(supabase, q, 25).catch(() => []),
  ]);

  // only places whose own name matches ("cebu" → Cebu City, not every town in Cebu province)
  const typed = normalize(q);
  const cityPlaces = places
    .filter((p) => p.level === "city_municipality" && normalize(p.cityMunicipalityName).includes(typed))
    .sort((a, b) => rank(a.cityMunicipalityName, typed) - rank(b.cityMunicipalityName, typed));
  const provinceOf = new Map(cityPlaces.map((p) => [normalize(cleanCity(p.cityMunicipalityName)), p.provinceName ?? p.regionName]));

  const counts = new Map<string, { name: string; events: number }>();
  for (const r of rows ?? []) {
    const raw = (r.city as string | null)?.trim();
    if (!raw) continue;
    const key = normalize(raw);
    const cur = counts.get(key);
    counts.set(key, { name: cur?.name ?? titleCase(raw), events: (cur?.events ?? 0) + 1 });
  }

  const results: CitySuggestion[] = [...counts.entries()]
    .sort((a, b) => b[1].events - a[1].events)
    .map(([key, v]) => {
      const province = provinceOf.get(key);
      return { name: v.name, province: province ? titleCase(province) : null, events: v.events };
    });

  for (const p of cityPlaces) {
    const key = normalize(cleanCity(p.cityMunicipalityName));
    if (counts.has(key) || results.some((r) => normalize(r.name) === key)) continue;
    results.push({ name: cleanCity(p.cityMunicipalityName), province: titleCase(p.provinceName ?? p.regionName), events: 0 });
  }

  return NextResponse.json({ results: results.slice(0, 8) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
