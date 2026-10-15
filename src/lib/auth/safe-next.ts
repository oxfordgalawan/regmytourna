/** Internal redirect targets only (path + optional query/hash). */
export function sanitizeNext(next: string | null | undefined): string | null {
  const trimmed = next?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

export function authHref(base: string, next?: string | null): string {
  const safe = sanitizeNext(next);
  if (!safe) return base;
  return `${base}?next=${encodeURIComponent(safe)}`;
}
