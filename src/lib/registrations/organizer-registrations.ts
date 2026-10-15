import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { relationOne } from "@/lib/supabase/relations";
export type OrganizerRegistrationRow = {
  id: string;
  player: string;
  division: string;
  status: string;
  payment_status: string;
  source: "online" | "pay_at_venue" | "desk";
  paidVia: "online" | "cash" | "qr" | null;
  feeCents: number;
  checkedIn: boolean;
  /** doubles partner's account status — informational, the entry never waits on it */
  partner: "on_platform" | "invited" | "declined" | "guest" | null;
  /** each player, primary first, with the email we have for them */
  players: Array<{ rowId: string; name: string; email: string | null; primary: boolean; hasAccount: boolean }>;
  doubles: boolean;
  /** a player left and the team hasn't named a new partner */
  needsPartner: boolean;
  /** someone was asked to take a player's place and hasn't answered */
  substitutePending: boolean;
};

/** Account emails for linked players; falls back to one lookup per user if the RPC isn't deployed yet. */
async function accountEmails(admin: ReturnType<typeof createAdminClient>, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await admin.rpc("auth_emails_for_users", { p_ids: ids });
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ id: string; email: string | null }>) if (r.email) map.set(r.id, r.email);
    return map;
  }
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) map.set(id, u.user.email);
    })
  );
  return map;
}

const ACTIVE = new Set(["confirmed", "awaiting_payment", "pending", "awaiting_partner"]);

export async function loadOrganizerRegistrations(tournamentId: string) {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();

  const [{ data: tournament }, { data: divisions }, { data: regs }] = await Promise.all([
    admin.from("tournaments").select("entry_fee_cents, allow_walk_in_payment").eq("id", tournamentId).single(),
    admin
      .from("tournament_divisions")
      .select("id, name, format, capacity, entry_fee_cents, bracket_state")
      .eq("tournament_id", tournamentId)
      .order("sort_order"),
    admin
      .from("registrations")
      .select(
        `id, status, payment_status, entry_source, division_id, needs_partner_since, ${REGISTRATION_PLAYERS_SELECT}, tournament_divisions(name, format, entry_fee_cents), check_ins(id), payments(method, status), partner_rows:registration_players(id, is_primary, user_id, guest_name, guest_email, partner_invite_status, profiles(full_name))`
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false }),
  ]);

  const defaultFee = tournament?.entry_fee_cents ?? 0;
  type PlayerRow = {
    id: string;
    is_primary: boolean;
    user_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    partner_invite_status: string | null;
    profiles: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  };
  const userIds = [
    ...new Set(
      (regs ?? []).flatMap((r) => ((r.partner_rows ?? []) as PlayerRow[]).map((p) => p.user_id).filter(Boolean) as string[])
    ),
  ];
  const regIds = (regs ?? []).map((r) => r.id);
  const [emails, { data: subs }] = await Promise.all([
    accountEmails(admin, userIds),
    regIds.length
      ? admin.from("entry_substitutions").select("registration_id").in("registration_id", regIds).eq("status", "pending")
      : Promise.resolve({ data: [] as Array<{ registration_id: string }> }),
  ]);
  const pendingSubs = new Set((subs ?? []).map((x) => x.registration_id));
  const rows: OrganizerRegistrationRow[] = (regs ?? []).map((r) => {
    const division = relationOne(r.tournament_divisions) as {
      name: string;
      format: string;
      entry_fee_cents: number | null;
    } | null;
    const playerRows = ((r.partner_rows ?? []) as PlayerRow[])
      .slice()
      .sort((x, y) => Number(y.is_primary) - Number(x.is_primary));
    const paid = ((r.payments ?? []) as Array<{ method: string; status: string }>).find((p) => p.status === "paid");
    const mate = playerRows.find((p) => !p.is_primary);
    return {
      id: r.id,
      partner: !mate
        ? null
        : mate.user_id
          ? "on_platform"
          : mate.partner_invite_status === "declined"
            ? "declined"
            : mate.guest_email
              ? "invited"
              : "guest",
      player: registrationName(r),
      doubles: division?.format === "doubles",
      needsPartner: Boolean(r.needs_partner_since) && division?.format === "doubles" && playerRows.length < 2,
      substitutePending: pendingSubs.has(r.id),
      players: playerRows.map((p) => ({
        rowId: p.id,
        name: (relationOne(p.profiles as never) as { full_name: string | null } | null)?.full_name || p.guest_name || "Player",
        email: (p.user_id ? emails.get(p.user_id) : null) ?? p.guest_email,
        primary: p.is_primary,
        hasAccount: Boolean(p.user_id),
      })),
      division: division?.name ?? "—",
      status: r.status,
      payment_status: r.payment_status,
      source: (r.entry_source ?? "online") as OrganizerRegistrationRow["source"],
      paidVia: (paid?.method as OrganizerRegistrationRow["paidVia"]) ?? null,
      feeCents: division?.entry_fee_cents ?? defaultFee,
      checkedIn: Array.isArray(r.check_ins) ? r.check_ins.length > 0 : Boolean(r.check_ins),
    };
  });

  const categories = (divisions ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    format: d.format as string,
    feeCents: d.entry_fee_cents ?? defaultFee,
    capacity: d.capacity as number | null,
    taken: (regs ?? []).filter((r) => r.division_id === d.id && ACTIVE.has(r.status)).length,
    drawStarted: Boolean(d.bracket_state && d.bracket_state !== "not_started"),
  }));

  return {
    rows,
    categories,
    allowWalkIn: Boolean(tournament?.allow_walk_in_payment),
  };
}
