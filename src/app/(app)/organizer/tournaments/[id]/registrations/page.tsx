import { RegistrationsTable } from "@/components/organizer/registrations-table";
import { PlayersRoster } from "@/components/organizer/players-roster";
import { loadOrganizerRegistrations } from "@/lib/registrations/organizer-registrations";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { getRegistrationMode } from "@/lib/tournaments/mode";
import { loadRoster } from "@/lib/import/server";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // bracket-only events: an imported player list instead of registrations
  if ((await getRegistrationMode(id)) === "bracket_only") {
    await requireOrganizerForTournament(id);
    return <PlayersRoster tournamentId={id} categories={await loadRoster(id)} />;
  }

  const { rows, categories, allowWalkIn } = await loadOrganizerRegistrations(id);

  return (
    <RegistrationsTable
      tournamentId={id}
      rows={rows}
      categories={categories}
      allowWalkIn={allowWalkIn}
    />
  );
}
