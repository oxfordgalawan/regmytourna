import { RegistrationsTable } from "@/components/organizer/registrations-table";
import { loadOrganizerRegistrations } from "@/lib/registrations/organizer-registrations";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
