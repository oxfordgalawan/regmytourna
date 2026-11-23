import { requireOrganizerSession } from "@/lib/auth/organizer-act-as";
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
import { getRegistrationMode } from "@/lib/tournaments/mode";
import { categoryGenderLabel, entrantNoun } from "@/lib/categories";
import { EditDivisionForm } from "@/components/organizer/edit-division-form";
import { LOCKED_BRACKET_STATES, parseBracketConfig } from "@/lib/bracket-format";
import { DivisionFormatButton } from "@/components/organizer/division-format-button";


export default async function DivisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOrganizerSession();
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

  const bracketOnly = (await getRegistrationMode(id)) === "bracket_only";

  const { data: entryRows } = await supabase
    .from("registrations")
    .select("division_id")
    .eq("tournament_id", id)
    .eq("status", "confirmed");
  const entriesByDivision = new Map<string, number>();
  for (const row of entryRows ?? []) {
    const key = row.division_id as string;
    entriesByDivision.set(key, (entriesByDivision.get(key) ?? 0) + 1);
  }

  const defaultEventFeeCents = tournament?.entry_fee_cents ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {divisions?.length
            ? `${divisions.length} ${divisions.length === 1 ? "category" : "categories"} · each one is its own bracket`
            : "Each category is its own bracket."}
        </p>
        <AddDivisionForm tournamentId={id} showFee={!bracketOnly} />
      </div>
      {divisions?.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Format</TableHead>
                {!bracketOnly && <TableHead className="pr-5 text-right">Fee</TableHead>}
                <TableHead className="w-[88px] pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisions.map((d) => {
                const bracketStarted = (d.bracket_state ?? "not_started") !== "not_started";
                const genderLabel = categoryGenderLabel(d.name);
                return (
                <TableRow key={d.id}>
                  <TableCell className="pl-5 font-medium text-bone">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="text-bone/90">{genderLabel}</span>
                    <span className="ml-1.5 text-xs capitalize opacity-70">({d.format})</span>
                  </TableCell>
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
                      bracketState={d.bracket_state ?? "not_started"}
                      challongeLocked={LOCKED_BRACKET_STATES.has(d.challonge_state ?? "")}
                    />
                  </TableCell>
                  {!bracketOnly && (
                    <TableCell className="pr-5 text-right font-mono">
                      {formatPhp(d.entry_fee_cents ?? tournament?.entry_fee_cents ?? 0, tournament?.currency)}
                      {d.entry_fee_cents == null && (
                        <span className="ml-2 text-xs text-muted-foreground">default</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="pr-5 text-right">
                    {!bracketStarted ? (
                      <EditDivisionForm
                        divisionId={d.id}
                        divisionName={d.name}
                        capacity={d.capacity}
                        entryFeeCents={d.entry_fee_cents}
                        defaultEventFeeCents={defaultEventFeeCents}
                        confirmedEntries={entriesByDivision.get(d.id) ?? 0}
                        format={d.format}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    )}
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          No categories yet. Use “Add category” — {bracketOnly ? "you need at least one before importing players." : "players need at least one to register."}
        </p>
      )}
    </div>
  );
}
