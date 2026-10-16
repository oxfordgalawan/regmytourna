import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { loadQueue } from "@/lib/queue/load";
import { QueueBoard } from "@/components/organizer/queue-board";
import { AutoRefresh } from "@/components/display/auto-refresh";

export const metadata = { title: "Queue" };

export default async function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrganizerForTournament(id);
  const data = await loadQueue(id);
  return (
    <>
      {/* umpires start and finish matches elsewhere — keep the board current */}
      <AutoRefresh seconds={15} clock={false} />
      <QueueBoard tournamentId={id} data={data} />
    </>
  );
}
