import Link from "next/link";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, match_number, round_label, team_a_label, team_b_label, status, court_id, courts(name), tournament_divisions(name)")
    .eq("tournament_id", id)
    .eq("is_bye", false)
    .neq("status", "cancelled")
    .order("match_number");

  if (!matches?.length) {
    return (
      <EmptyState
        icon={Swords}
        title="No matches yet"
        description="Seed and start a category on the Draw tab — its matches appear here and on the umpire board."
        action={
          <Button variant="outline" asChild>
            <Link href={`/organizer/tournaments/${id}/draw`}>Go to the draw</Link>
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
            <TableHead className="pr-5 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m) => {
            const court = relationOne(m.courts) as { name: string } | null;
            const division = relationOne(m.tournament_divisions) as { name: string } | null;
            return (
              <TableRow key={m.id}>
                <TableCell className="pl-5 font-mono text-muted-foreground">
                  {m.match_number ?? "—"}
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
                <TableCell className="pr-5 text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/umpire/${id}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
                      {m.status === "completed" ? "View" : "Score"}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
