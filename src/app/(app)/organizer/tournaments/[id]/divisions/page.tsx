import { createClient } from "@/lib/supabase/server";
import { formatPhp } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddDivisionForm } from "@/components/organizer/add-division-form";
import { entrantNoun } from "@/lib/categories";
import { LOCKED_BRACKET_STATES, parseBracketConfig } from "@/lib/bracket-format";
import { DivisionFormatButton } from "@/components/organizer/division-format-button";


export default async function DivisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: divisions } = await supabase
    .from("tournament_divisions")
    .select("*")
    .eq("tournament_id", id)
    .order("sort_order");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("entry_fee_cents, currency")
    .eq("id", id)
    .single();

  return (
    <div className="space-y-6">
      <AddDivisionForm tournamentId={id} />
      {divisions?.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="pr-5 text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="pl-5 font-medium text-bone">{d.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{d.format}</TableCell>
                  <TableCell className="font-mono">
                    {d.capacity ? `${d.capacity} ${entrantNoun(d.format, d.capacity)}` : "No cap"}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <DivisionFormatButton
                      divisionId={d.id}
                      name={d.name}
                      teams={d.capacity ?? 16}
                      noun={entrantNoun(d.format)}
                      config={parseBracketConfig(d.bracket_config, d.capacity ?? 16)}
                      locked={LOCKED_BRACKET_STATES.has(d.challonge_state ?? "")}
                    />
                  </TableCell>
                  <TableCell className="pr-5 text-right font-mono">
                    {formatPhp(d.entry_fee_cents ?? tournament?.entry_fee_cents ?? 0, tournament?.currency)}
                    {d.entry_fee_cents == null && (
                      <span className="ml-2 text-xs text-muted-foreground">default</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          No categories yet. Add one above — players need at least one to register.
        </p>
      )}
    </div>
  );
}
