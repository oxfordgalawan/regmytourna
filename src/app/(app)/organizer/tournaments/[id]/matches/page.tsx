import Link from "next/link";
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
    .select("id, match_number, team_a_label, team_b_label, status, court_id, courts(name)")
    .eq("tournament_id", id)
    .order("match_number");

  if (!matches?.length) {
    return (
      <EmptyState
        icon={Swords}
        title="No matches yet"
        description="Link a Challonge bracket on the Overview tab and sync — matches will be pulled in automatically."
        action={
          <Button variant="outline" asChild>
            <Link href={`/organizer/tournaments/${id}#challonge`}>Go to Challonge sync</Link>
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
                <TableCell className="text-muted-foreground">{court?.name ?? "Unassigned"}</TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/court/${m.court_id ?? m.id}`}>Score</Link>
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
