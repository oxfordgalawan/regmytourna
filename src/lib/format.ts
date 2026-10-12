export function formatPhp(cents: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Parses a `YYYY-MM-DD` date column as a local calendar date (no timezone shift). */
function parseDay(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

export function dateTile(value: string | null) {
  if (!value) return null;
  const d = parseDay(value);
  return {
    month: d.toLocaleString("en-PH", { month: "short" }).toUpperCase(),
    day: d.getDate().toString().padStart(2, "0"),
    weekday: d.toLocaleString("en-PH", { weekday: "short" }),
  };
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates to be announced";
  const s = parseDay(start);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!end || end === start) return s.toLocaleDateString("en-PH", opts);
  const e = parseDay(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-PH", opts)} – ${e.toLocaleDateString("en-PH", opts)}`;
}

export function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "in 3 days", "tomorrow", "today" — or null if in the past / unknown. */
export function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((parseDay(value).getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return null;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}
