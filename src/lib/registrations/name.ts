type PlayerRow = {
  guest_name: string | null;
  is_primary?: boolean | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

/** Select string that loads everything `registrationName` needs. */
export const REGISTRATION_PLAYERS_SELECT =
  "registration_players(guest_name, is_primary, profiles(full_name))";

/** "Juan Dela Cruz / Maria Santos" for doubles, the player's name for singles. */
export function registrationName(reg: { registration_players?: unknown }) {
  const players = ((reg.registration_players ?? []) as PlayerRow[])
    .slice()
    .sort((x, y) => Number(Boolean(y.is_primary)) - Number(Boolean(x.is_primary)));
  return (
    players
      .map((p) => {
        const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        return prof?.full_name || p.guest_name;
      })
      .filter(Boolean)
      .join(" / ") || "Unnamed entry"
  );
}
