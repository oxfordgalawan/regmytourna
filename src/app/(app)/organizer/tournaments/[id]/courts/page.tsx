import { requireOrganizerSession } from "@/lib/auth/organizer-act-as";
import { CourtsPanel, type CourtRow } from "@/components/organizer/courts-panel";

export default async function CourtsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOrganizerSession();
  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, sort_order, active")
    .eq("tournament_id", id)
    .order("sort_order");

  const rows: CourtRow[] = (courts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    active: c.active ?? true,
  }));

  return <CourtsPanel tournamentId={id} courts={rows} />;
}
