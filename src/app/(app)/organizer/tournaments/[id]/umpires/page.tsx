import { getAppUrl } from "@/lib/env/server";
import { getUmpireAccess } from "@/lib/auth/umpire";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { UmpireAccessCard } from "@/components/organizer/umpire-access-card";

export default async function UmpiresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrganizerForTournament(id);
  const access = await getUmpireAccess(id);

  return (
    <UmpireAccessCard
      tournamentId={id}
      umpireUrl={`${getAppUrl()}/umpire/${id}`}
      hasPin={Boolean(access?.pin_hash)}
    />
  );
}
