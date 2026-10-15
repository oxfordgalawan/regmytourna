/** Two-letter initials for avatars and profile headers. */
export function profileInitials(name: string, email?: string | null) {
  const source = name.trim() || email || "U";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
