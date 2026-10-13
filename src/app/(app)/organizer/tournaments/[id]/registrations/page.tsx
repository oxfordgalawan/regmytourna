import { createClient } from "@/lib/supabase/server";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { RegistrationsTable, type RegistrationRow } from "@/components/organizer/registrations-table";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: tournament }, { data: divisions }, { data: regs }] = await Promise.all([
    supabase.from("tournaments").select("entry_fee_cents, allow_walk_in_payment").eq("id", id).single(),
    supabase
      .from("tournament_divisions")
      .select("id, name, format, capacity, entry_fee_cents, bracket_state")
      .eq("tournament_id", id)
      .order("sort_order"),
    supabase
      .from("registrations")
      .select(
        `id, status, payment_status, entry_source, division_id, ${REGISTRATION_PLAYERS_SELECT}, tournament_divisions(name, entry_fee_cents), check_ins(id), payments(method, status)`
      )
      .eq("tournament_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const defaultFee = tournament?.entry_fee_cents ?? 0;
  const rows: RegistrationRow[] = (regs ?? []).map((r) => {
    const division = relationOne(r.tournament_divisions) as { name: string; entry_fee_cents: number | null } | null;
    const paid = ((r.payments ?? []) as Array<{ method: string; status: string }>).find((p) => p.status === "paid");
    return {
      id: r.id,
      player: registrationName(r),
      division: division?.name ?? "—",
      status: r.status,
      payment_status: r.payment_status,
      source: (r.entry_source ?? "online") as RegistrationRow["source"],
      paidVia: (paid?.method as RegistrationRow["paidVia"]) ?? null,
      feeCents: division?.entry_fee_cents ?? defaultFee,
      checkedIn: Array.isArray(r.check_ins) ? r.check_ins.length > 0 : Boolean(r.check_ins),
    };
  });

  const active = new Set(["confirmed", "awaiting_payment", "pending", "awaiting_partner"]);
  const categories = (divisions ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    format: d.format as string,
    feeCents: d.entry_fee_cents ?? defaultFee,
    capacity: d.capacity as number | null,
    taken: (regs ?? []).filter((r) => r.division_id === d.id && active.has(r.status)).length,
    drawStarted: Boolean(d.bracket_state && d.bracket_state !== "not_started"),
  }));

  return (
    <RegistrationsTable
      tournamentId={id}
      rows={rows}
      categories={categories}
      allowWalkIn={Boolean(tournament?.allow_walk_in_payment)}
    />
  );
}
