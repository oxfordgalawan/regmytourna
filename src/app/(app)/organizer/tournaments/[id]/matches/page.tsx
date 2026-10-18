import Link from "next/link";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { relationOne } from "@/lib/supabase/relations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { MatchUmpireControls } from "@/components/organizer/match-umpire-controls";
import { QueueButton, type CourtSummary } from "@/components/organizer/queue-dialog";
import { isPlayableMatch } from "@/lib/umpire/playable";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { gamesToWinFromDivisionConfig, parseBracketConfig } from "@/lib/bracket-format";
import { formatMatchScoreSummary, matchScoreFieldsFromRow } from "@/lib/scoring/match-display-score";
import { cn } from "@/lib/utils";

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: matches }, { data: umpires }, { data: courtRows }, { data: divisions }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "*, courts(name), tournament_divisions(name)"
      )
      .eq("tournament_id", id)
      .eq("is_bye", false)
      .neq("status", "cancelled")
      .order("umpire_queue_order", { ascending: true, nullsFirst: false })
      .order("match_number"),
    admin
      .from("tournament_umpires")
      .select("id, name")
      .eq("tournament_id", id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("courts")
      .select("id, name, active, sort_order")
      .eq("tournament_id", id)
      .order("sort_order"),
    supabase.from("tournament_divisions").select("id, bracket_config, capacity").eq("tournament_id", id),
  ]);

  const gamesToWinByDivision = new Map(
    (divisions ?? []).map((d) => [
      d.id,
      gamesToWinFromDivisionConfig(parseBracketConfig(d.bracket_config, d.capacity ?? 16)),
    ])
  );

  const hasLive = (matches ?? []).some((m) => m.status === "in_progress");

  // each court: playing now? how many waiting?
  const live = new Set((matches ?? []).filter((m) => m.status === "in_progress" && m.court_id).map((m) => m.court_id));
  const courts: CourtSummary[] = (courtRows ?? [])
    .filter((c) => c.active !== false)
    .map((c) => ({
      id: c.id,
      name: c.name as string,
      live: live.has(c.id),
      queued: (matches ?? []).filter((m) => m.court_id === c.id && m.status === "scheduled").length,
    }));

  // place in each court's line among matches still waiting (1 = next)
  const linePlace = new Map<string, number>();
  for (const c of courtRows ?? []) {
    (matches ?? [])
      .filter((m) => m.court_id === c.id && m.status === "scheduled")
      .sort((a, b) => ((a.court_queue_position as number | null) ?? 9999) - ((b.court_queue_position as number | null) ?? 9999))
      .forEach((m, i) => linePlace.set(m.id, i + 1));
  }
  const roster = (umpires ?? []).map((u) => ({ id: u.id, name: u.name as string }));
  const umpireName = new Map(roster.map((u) => [u.id, u.name]));

  if (!matches?.length) {
    return (
      <EmptyState
        icon={Swords}
        title="No matches yet"
        description="Seed and start a category on the Brackets tab — its matches appear here and on the umpire queue."
        action={
          <Button variant="outline" asChild>
            <Link href={`/organizer/tournaments/${id}/draw`}>Go to brackets</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {hasLive && <AutoRefresh seconds={15} clock={false} />}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">#</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Court</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Umpire</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => {
              const court = relationOne(m.courts) as { name: string } | null;
              const division = relationOne(m.tournament_divisions) as { name: string } | null;
              const assignedName = m.assigned_umpire_id
                ? umpireName.get(m.assigned_umpire_id)
                : null;
              const gamesToWin = m.division_id ? (gamesToWinByDivision.get(m.division_id) ?? 1) : 1;
              const scoreLine = formatMatchScoreSummary(matchScoreFieldsFromRow(m), gamesToWin);
              const liveRow = m.status === "in_progress";
              return (
                <TableRow key={m.id}>
                  <TableCell className="pl-5 font-mono text-muted-foreground">
                    {m.umpire_queue_order ?? m.match_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-bone">
                    {m.team_a_label}
                    <span className="mx-2 font-mono text-xs text-muted-foreground">vs</span>
                    {m.team_b_label}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {division?.name ?? "—"}
                    {m.round_label && <span className="block font-mono text-xs">{m.round_label}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.status !== "scheduled" || !isPlayableMatch(m) ? (
                      (court?.name ?? (m.status === "scheduled" ? <span className="text-xs">Waiting for teams</span> : "—"))
                    ) : !courts.length ? (
                      <Link href={`/organizer/tournaments/${id}/courts`} className="text-xs underline underline-offset-4 hover:text-bone">
                        Add courts
                      </Link>
                    ) : (
                      <QueueButton
                        tournamentId={id}
                        match={{
                          id: m.id,
                          teamA: m.team_a_label ?? "TBD",
                          teamB: m.team_b_label ?? "TBD",
                          divisionName: division?.name ?? "Category",
                        }}
                        courts={courts}
                        currentCourtId={courts.some((c) => c.id === m.court_id) ? m.court_id : null}
                        position={linePlace.get(m.id) ?? null}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      liveRow ? "text-bone" : scoreLine ? "text-bone/85" : "text-muted-foreground"
                    )}
                  >
                    {liveRow && (
                      <span className="mr-1.5 inline-block size-1.5 animate-pulse-dot rounded-full bg-rust align-middle" aria-hidden />
                    )}
                    {scoreLine ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{assignedName ?? "—"}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <MatchUmpireControls
                        tournamentId={id}
                        matchId={m.id}
                        umpireId={m.assigned_umpire_id}
                        umpires={roster}
                        status={m.status}
                      />
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/umpire/${id}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
                          {m.status === "completed" ? "View" : "Score"}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
