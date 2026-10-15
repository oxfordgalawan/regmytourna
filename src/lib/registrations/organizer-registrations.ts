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
};

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
        `id, status, payment_status, entry_source, division_id, ${REGISTRATION_PLAYERS_SELECT}, tournament_divisions(name, entry_fee_cents), check_ins(id), payments(method, status), partner_rows:registration_players(is_primary, user_id, guest_email, partner_invite_status)`
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false }),
  ]);

  const defaultFee = tournament?.entry_fee_cents ?? 0;
  const rows: OrganizerRegistrationRow[] = (regs ?? []).map((r) => {
    const division = relationOne(r.tournament_divisions) as { name: string; entry_fee_cents: number | null } | null;
    const paid = ((r.payments ?? []) as Array<{ method: string; status: string }>).find((p) => p.status === "paid");
    const mate = ((r.partner_rows ?? []) as Array<{
      is_primary: boolean;
      user_id: string | null;
      guest_email: string | null;
      partner_invite_status: string | null;
    }>).find((p) => !p.is_primary);
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
