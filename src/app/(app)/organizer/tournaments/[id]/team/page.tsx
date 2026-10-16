import { notFound } from "next/navigation";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { getAppUrl } from "@/lib/env/server";
import { loadTeam } from "@/lib/organizers/team";
import { TeamPanel } from "@/components/organizer/team-panel";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOrganizerForTournament(id);
  const data = await loadTeam(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      {!data.ready && (
        <p className="rounded-xl border border-brass/40 bg-brass/[0.06] px-4 py-3 text-sm text-bone">
          Invites need the latest database migration — run it to start inviting co-organizers.
        </p>
      )}
      <TeamPanel
        tournamentId={id}
        meId={user.id}
        owner={data.tournament.ownerId === user.id}
        team={data.team}
        pending={data.pending}
        link={data.link}
        appUrl={getAppUrl()}
      />
    </div>
  );
}
