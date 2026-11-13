/**
 * Forgiving tournament search: every typed word must match some word of the
 * event's name, city, venue or address — exactly, as a prefix (still typing),
 * or with a small typo ("pikultura" → "PICKULTURA").
 */

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function words(s: string | null | undefined) {
  return s ? normalize(s).split(" ").filter(Boolean) : [];
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length);

/** How well one typed word matches one word of the event (0–1). */
function wordScore(q: string, token: string) {
  if (token === q) return 1;
  if (token.startsWith(q)) return 0.95;
  if (token.includes(q) && q.length >= 3) return 0.85;
  // too short to guess at
  if (q.length < 4) return 0;
  // whole word with a typo, or the start of a longer word being typed with a typo
  const best = Math.max(
    similarity(q, token),
    similarity(q, token.slice(0, q.length)),
    similarity(q, token.slice(0, q.length + 1))
  );
  return best >= 0.75 ? best * 0.8 : 0;
}

export type Searchable = {
  name: string;
  city?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
};

/** 0 when any typed word has no match; otherwise higher is better. */
export function matchScore(query: string, t: Searchable) {
  const typed = words(query);
  if (!typed.length) return 0;
  const nameWords = words(t.name);
  const otherWords = [...words(t.city), ...words(t.venue_name), ...words(t.venue_address)];
  let total = 0;
  for (const q of typed) {
    // a hit in the event name counts a little more than one in the venue/city
    const inName = Math.max(0, ...nameWords.map((w) => wordScore(q, w)));
    const elsewhere = Math.max(0, ...otherWords.map((w) => wordScore(q, w))) * 0.9;
    const best = Math.max(inName, elsewhere);
    if (!best) return 0;
    total += best;
  }
  return total / typed.length;
}

/** True when the match needed typo tolerance (shown as "close matches"). */
export function isExactish(query: string, t: Searchable) {
  const hay = normalize([t.name, t.city, t.venue_name, t.venue_address].filter(Boolean).join(" "));
  return words(query).every((w) => hay.includes(w));
}
