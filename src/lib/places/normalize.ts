/** Normalize user search query for ph_places.search_text matching. */
export function normalizePlaceSearchQuery(raw: string): string {
  let q = raw.trim().replace(/\s+/g, " ").toLowerCase();
  q = q.replace(/^(brgy\.?|barangay)\s+/i, "");
  return q;
}

export function normalizePsgcCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padEnd(10, "0");
}

export function friendlyRegionName(name: string): string {
  const match = name.match(/\(([^)]+)\)/);
  return match ? match[1] : name;
}

export function buildPlaceSearchText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .flatMap((p) => String(p).toLowerCase().replace(/[(),.]/g, " ").split(/\s+/))
    .filter((t) => t.length > 0 && t !== "brgy" && t !== "barangay")
    .join(" ");
}
