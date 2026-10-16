import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CourtPlayer = { name: string; avatarUrl: string | null };

export type OfficiatingEvent = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  operatorLabel: string | null;
  createdAt: string;
};

type PlayerRow = {
  guest_name: string | null;
  is_primary: boolean;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

/** Each team's players (primary first); falls back to splitting the team label. */
export async function loadMatchPlayers(match: {
  team_a_registration_id?: string | null;
  team_b_registration_id?: string | null;
  team_a_label: string;
  team_b_label: string;
}): Promise<{ a: CourtPlayer[]; b: CourtPlayer[] }> {
  const admin = createAdminClient();
  const ids = [match.team_a_registration_id, match.team_b_registration_id].filter((x): x is string => Boolean(x));
  const { data } = ids.length
    ? await admin
        .from("registration_players")
        .select("registration_id, guest_name, is_primary, created_at, profiles(full_name, avatar_url)")
        .in("registration_id", ids)
    : { data: [] };

  const team = (regId: string | null | undefined, label: string): CourtPlayer[] => {
    const rows = ((data ?? []) as unknown as Array<PlayerRow & { registration_id: string }>)
      .filter((r) => r.registration_id === regId)
      .sort((x, y) => Number(y.is_primary) - Number(x.is_primary) || x.created_at.localeCompare(y.created_at))
      .map((r) => ({ name: (r.profiles?.full_name || r.guest_name || "").trim(), avatarUrl: r.profiles?.avatar_url ?? null }))
      .filter((p) => p.name);
    if (rows.length) return rows.slice(0, 2);
    return label
      .split(/\s*\/\s*|\s+&\s+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => ({ name, avatarUrl: null }));
  };

  return {
    a: team(match.team_a_registration_id, match.team_a_label),
    b: team(match.team_b_registration_id, match.team_b_label),
  };
}

/** Timers run and games started, oldest first. Empty before the migration. */
export async function loadOfficiatingLog(matchId: string): Promise<OfficiatingEvent[]> {
  const { data, error } = await createAdminClient()
    .from("match_events")
    .select("id, kind, payload, operator_label, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((e) => ({
    id: e.id as string,
    kind: e.kind as string,
    payload: (e.payload ?? {}) as Record<string, unknown>,
    operatorLabel: (e.operator_label as string | null) ?? null,
    createdAt: e.created_at as string,
  }));
}
