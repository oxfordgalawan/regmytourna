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

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: matches }, { data: umpires }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_number, round_label, team_a_label, team_b_label, status, court_id, assigned_umpire_id, umpire_queue_order, courts(name), tournament_divisions(name)"
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
  ]);

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
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">#</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Court</TableHead>
            <TableHead>Status</TableHead>
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
                <TableCell className="text-muted-foreground">{court?.name ?? "Unassigned"}</TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
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
  );
}
