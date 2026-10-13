import Link from "next/link";
import { NAV_BACK } from "@/lib/nav-transitions";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MonitorPlay } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createClient } from "@/lib/supabase/server";
import { TournamentNav } from "@/components/organizer/tournament-nav";
import { RouteTransition } from "@/components/motion/route-transition";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

export default async function TournamentManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const allowed = await isOrganizerForTournament(user.id, id);
  if (!allowed) notFound();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, slug, status")
    .eq("id", id)
    .single();
  if (!tournament) notFound();

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
          <div className="flex flex-wrap gap-2">
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
      <TournamentNav tournamentId={id} />
      <RouteTransition scope="tab">{children}</RouteTransition>
    </div>
  );
}
