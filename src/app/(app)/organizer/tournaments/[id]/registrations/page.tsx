import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { relationOne } from "@/lib/supabase/relations";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrationsTable } from "@/components/organizer/registrations-table";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: regs } = await supabase
    .from("registrations")
    .select(
      "id, status, payment_status, challonge_sync_status, profiles:registered_by(full_name), tournament_divisions(name), check_ins(id)"
    )
    .eq("tournament_id", id)
    .order("created_at", { ascending: false });

  if (!regs?.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No entries yet"
        description="Once players register, they'll appear here with payment and check-in status."
      />
    );
  }

  const rows = regs.map((r) => {
    const profile = relationOne(r.profiles) as { full_name: string } | null;
    const division = relationOne(r.tournament_divisions) as { name: string } | null;
    return {
      id: r.id,
      player: profile?.full_name ?? "—",
      division: division?.name ?? "—",
      status: r.status,
      payment_status: r.payment_status,
      challonge_sync_status: r.challonge_sync_status,
      checkedIn: Array.isArray(r.check_ins) ? r.check_ins.length > 0 : Boolean(r.check_ins),
    };
  });

  return <RegistrationsTable tournamentId={id} rows={rows} />;
}
