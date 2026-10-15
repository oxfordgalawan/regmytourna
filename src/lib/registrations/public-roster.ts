import { createAdminClient } from "@/lib/supabase/admin";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";

const SLOT_STATUSES = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"] as const;

export type PublicRosterEntry = {
  name: string;
  status: string;
  statusLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  awaiting_payment: "Reserved",
  pending: "Pending",
  awaiting_partner: "Awaiting partner",
  waitlisted: "Waitlist",
};

export async function loadPublicDivisionRoster(tournamentId: string, divisionId: string) {
  const admin = createAdminClient();

  const [{ data: division }, { data: tournament }] = await Promise.all([
    admin
      .from("tournament_divisions")
      .select("id, name, capacity, tournament_id")
      .eq("id", divisionId)
      .eq("tournament_id", tournamentId)
      .maybeSingle(),
    admin.from("tournaments").select("is_public").eq("id", tournamentId).maybeSingle(),
  ]);

  if (!division) return { error: "Category not found." as const };
  if (!tournament?.is_public) return { error: "Not available." as const };

  const { data: regs } = await admin
    .from("registrations")
    .select(`id, status, waitlist_position, created_at, ${REGISTRATION_PLAYERS_SELECT}`)
    .eq("tournament_id", tournamentId)
    .eq("division_id", divisionId)
    .in("status", [...SLOT_STATUSES, "waitlisted"])
    .order("created_at", { ascending: true });

  const slots: PublicRosterEntry[] = [];
  const waitlist: PublicRosterEntry[] = [];

  for (const r of regs ?? []) {
    const name = registrationName(r);
    const status = r.status as string;
    const entry: PublicRosterEntry = {
      name,
      status,
      statusLabel: STATUS_LABEL[status] ?? status,
    };
    if (status === "waitlisted") {
      waitlist.push({
        ...entry,
        statusLabel: r.waitlist_position
          ? `Waitlist #${r.waitlist_position}`
          : STATUS_LABEL.waitlisted,
      });
    } else if (SLOT_STATUSES.includes(status as (typeof SLOT_STATUSES)[number])) {
      slots.push(entry);
    }
  }

  waitlist.sort((a, b) => {
    const pos = (name: string) =>
      regs?.find((x) => x.status === "waitlisted" && registrationName(x) === name)?.waitlist_position ??
      999;
    return pos(a.name) - pos(b.name);
  });

  return {
    divisionName: division.name as string,
    capacity: division.capacity as number | null,
    slots,
    waitlist,
    taken: slots.length,
  };
}
