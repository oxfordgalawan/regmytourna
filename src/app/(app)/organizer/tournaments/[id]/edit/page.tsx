import { notFound } from "next/navigation";
import { requireOrganizerSession } from "@/lib/auth/organizer-act-as";
import { getRegistrationMode } from "@/lib/tournaments/mode";
import { EditTournamentForm, type EditableTournament } from "@/components/organizer/edit-tournament-form";
import { tournamentCanBeDeleted } from "@/app/actions/tournaments";
import { TournamentDangerZone } from "@/components/organizer/tournament-danger-zone";
import type { TournamentStatus } from "@/types/database";

export const metadata = { title: "Edit event" };

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOrganizerSession();
  const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
  if (!t) notFound();
  const bracketOnly = (await getRegistrationMode(id)) === "bracket_only";
  const canDelete = await tournamentCanBeDeleted(id);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="display text-3xl text-bone">Edit event</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update the details and cover photo players see.</p>
      </div>
      <TournamentDangerZone
        tournamentId={id}
        status={t.status as TournamentStatus}
        canDelete={canDelete}
      />
      <EditTournamentForm tournament={t as EditableTournament} bracketOnly={bracketOnly} />
    </div>
  );
}
