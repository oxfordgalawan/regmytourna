import Link from "next/link";
import { NAV_BACK } from "@/lib/nav-transitions";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MonitorPlay } from "lucide-react";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { requireOrganizerSession } from "@/lib/auth/organizer-act-as";
import { TournamentNav } from "@/components/organizer/tournament-nav";
import { getRegistrationMode } from "@/lib/tournaments/mode";
import { RouteTransition } from "@/components/motion/route-transition";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { TournamentStatusControls } from "@/components/organizer/tournament-status-controls";
import type { TournamentStatus } from "@/types/database";

export default async function TournamentManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, supabase } = await requireOrganizerSession();
  const allowed = await isOrganizerForTournament(user.id, id, user);
  if (!allowed) notFound();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, slug, status")
    .eq("id", id)
    .single();
  if (!tournament) notFound();

  const bracketOnly = (await getRegistrationMode(id)) === "bracket_only";

  return (
    <div className="space-y-8">
      <div>
        <Link
          transitionTypes={NAV_BACK}
          href="/organizer/tournaments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          My events
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <StatusBadge status={tournament.status} />
            <h1 className="display mt-3 text-5xl text-bone text-balance sm:text-6xl">
              {tournament.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TournamentStatusControls
              tournamentId={id}
              status={tournament.status as TournamentStatus}
              bracketOnly={bracketOnly}
            />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/tournaments/${tournament.slug}`} target="_blank">
                <ExternalLink />
                Public page
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/display/${id}`} target="_blank">
                <MonitorPlay />
                TV display
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <TournamentNav tournamentId={id} bracketOnly={bracketOnly} />
      <RouteTransition scope="tab">{children}</RouteTransition>
    </div>
  );
}
