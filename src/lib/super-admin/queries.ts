import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import { relationOne } from "@/lib/supabase/relations";

type AdminClient = SupabaseClient<Database>;

export async function fetchAuthEmailMap(admin: AdminClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) map.set(u.id, u.email);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  return map;
}

export async function getPlatformOverview(admin: AdminClient) {
  const [
    { count: profileCount },
    { data: tournaments },
    { count: registrationCount },
    { count: pendingWithdrawalCount },
    { data: recentProfiles },
    { data: organizerProfiles },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("tournaments").select("id, status, owner_id"),
    admin.from("registrations").select("*", { count: "exact", head: true }),
    admin
      .from("withdrawal_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("profiles")
      .select("id, full_name, account_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin.from("profiles").select("id").eq("account_type", "organizer"),
  ]);

  const ownerIds = new Set((tournaments ?? []).map((t) => t.owner_id));
  for (const p of organizerProfiles ?? []) ownerIds.add(p.id);

  const statusCounts: Record<string, number> = {};
  for (const t of tournaments ?? []) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  return {
    profileCount: profileCount ?? 0,
    organizerCount: ownerIds.size,
    tournamentCount: tournaments?.length ?? 0,
    registrationCount: registrationCount ?? 0,
    pendingWithdrawalCount: pendingWithdrawalCount ?? 0,
    statusCounts,
    recentProfiles: recentProfiles ?? [],
  };
}

export type OrganizerRow = {
  id: string;
  fullName: string;
  email: string | null;
  accountType: string;
  tournamentCount: number;
  lastActivity: string | null;
};

export async function listPlatformOrganizers(admin: AdminClient): Promise<OrganizerRow[]> {
  const emailMap = await fetchAuthEmailMap(admin);

  const [{ data: profiles }, { data: tournaments }] = await Promise.all([
    admin.from("profiles").select("id, full_name, account_type, updated_at"),
    admin.from("tournaments").select("owner_id, updated_at"),
  ]);

  const stats = new Map<string, { count: number; lastActivity: string | null }>();
  for (const t of tournaments ?? []) {
    const cur = stats.get(t.owner_id) ?? { count: 0, lastActivity: null };
    cur.count += 1;
    if (!cur.lastActivity || t.updated_at > cur.lastActivity) {
      cur.lastActivity = t.updated_at;
    }
    stats.set(t.owner_id, cur);
  }

  const organizerIds = new Set<string>();
  for (const p of profiles ?? []) {
    if (p.account_type === "organizer") organizerIds.add(p.id);
  }
  for (const id of stats.keys()) organizerIds.add(id);

  const rows: OrganizerRow[] = [];
  for (const id of organizerIds) {
    const profile = profiles?.find((p) => p.id === id);
    const s = stats.get(id);
    rows.push({
      id,
      fullName: profile?.full_name || "—",
      email: emailMap.get(id) ?? null,
      accountType: profile?.account_type ?? "—",
      tournamentCount: s?.count ?? 0,
      lastActivity: s?.lastActivity ?? profile?.updated_at ?? null,
    });
  }

  rows.sort((a, b) => b.tournamentCount - a.tournamentCount || a.fullName.localeCompare(b.fullName));
  return rows;
}

export type TournamentRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  city: string | null;
  isDemo: boolean;
  ownerName: string;
  ownerId: string;
  registrationCount: number;
};

export async function listPlatformTournaments(admin: AdminClient): Promise<TournamentRow[]> {
  const { data: tournaments, error } = await admin
    .from("tournaments")
    .select(
      "id, name, slug, status, start_date, end_date, city, is_demo, owner_id, profiles!tournaments_owner_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: regCounts } = await admin.from("registrations").select("tournament_id");
  const countByTournament = new Map<string, number>();
  for (const r of regCounts ?? []) {
    countByTournament.set(r.tournament_id, (countByTournament.get(r.tournament_id) ?? 0) + 1);
  }

  return (tournaments ?? []).map((t) => {
    const owner = relationOne(t.profiles as { full_name: string } | { full_name: string }[] | null);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      startDate: t.start_date,
      endDate: t.end_date,
      city: t.city,
      isDemo: t.is_demo,
      ownerName: owner?.full_name ?? "—",
      ownerId: t.owner_id,
      registrationCount: countByTournament.get(t.id) ?? 0,
    };
  });
}

export type PlayerRow = {
  id: string;
  fullName: string;
  email: string | null;
  accountType: string;
  registrationCount: number;
  paidRegistrationCount: number;
  createdAt: string;
};

export async function listPlatformPlayers(admin: AdminClient): Promise<PlayerRow[]> {
  const emailMap = await fetchAuthEmailMap(admin);

  const [{ data: profiles }, { data: registrations }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, account_type, created_at")
      .order("created_at", { ascending: false }),
    admin.from("registrations").select("registered_by, payment_status"),
  ]);

  const regStats = new Map<string, { total: number; paid: number }>();
  for (const r of registrations ?? []) {
    const cur = regStats.get(r.registered_by) ?? { total: 0, paid: 0 };
    cur.total += 1;
    if (r.payment_status === "paid") cur.paid += 1;
    regStats.set(r.registered_by, cur);
  }

  return (profiles ?? []).map((p) => {
    const s = regStats.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name || "—",
      email: emailMap.get(p.id) ?? null,
      accountType: p.account_type,
      registrationCount: s?.total ?? 0,
      paidRegistrationCount: s?.paid ?? 0,
      createdAt: p.created_at,
    };
  });
}
