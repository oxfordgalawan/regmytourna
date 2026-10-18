import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { loadDivisionContext } from "@/lib/draw/server";
import { buildDrawView } from "@/lib/draw/view";
import { currentSwissRound, poolStageEditable, stageDone } from "@/lib/bracket-engine";
import { describeFormat, FINAL_TYPE_LABELS } from "@/lib/bracket-format";
import { entrantNoun } from "@/lib/categories";
import { NAV_BACK } from "@/lib/nav-transitions";
import { DrawControls } from "@/components/draw/draw-controls";
import { SeedingWorkspace } from "@/components/draw/seeding-workspace";
import { BracketView } from "@/components/draw/bracket-view";
import { AutoRefresh } from "@/components/display/auto-refresh";

export default async function CategoryDrawPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>;
}) {
  const { id, divisionId } = await params;
  await requireOrganizerForTournament(id);
  const ctx = await loadDivisionContext(divisionId);
  if (!ctx || ctx.division.tournament_id !== id) notFound();

  const view = buildDrawView(ctx);
  const format = describeFormat(ctx.config, Math.max(ctx.entries.length, 2));
  const swiss = ctx.matches.filter((m) => m.stage === "swiss");
  const started = ctx.division.bracket_state !== "not_started";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/organizer/tournaments/${id}/draw`}
          transitionTypes={NAV_BACK}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          All categories
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-4xl text-bone">{ctx.division.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span>{format.name}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {ctx.entries.length} {entrantNoun(ctx.division.format, ctx.entries.length)}
              </span>
              {!started && (
                <Link href={`/organizer/tournaments/${id}/divisions`} className="underline-offset-4 hover:text-bone hover:underline">
                  Change format
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>

      <DrawControls
        divisionId={divisionId}
        divisionName={ctx.division.name}
        state={ctx.division.bracket_state}
        hasPools={Boolean(ctx.config.pools) && ctx.entries.length > (ctx.config.pools?.size ?? 0)}
        finalLabel={FINAL_TYPE_LABELS[ctx.config.final.type]}
        isSwiss={ctx.config.final.type === "swiss"}
        swissRound={currentSwissRound(swiss)}
        swissRounds={ctx.config.final.rounds}
        swissRoundDone={stageDone(swiss)}
        entries={ctx.entries.length}
        challongeUrl={ctx.division.challonge_url}
      />

      {started ? (
        <>
          <AutoRefresh seconds={20} clock={false} />
          <BracketView
            mode="organizer"
            tournamentId={id}
            divisionId={divisionId}
            bracketConfig={ctx.config}
            poolsEditable={ctx.division.bracket_state === "pools" && poolStageEditable(ctx.matches)}
            {...view}
          />
        </>
      ) : (
        <SeedingWorkspace
          divisionId={divisionId}
          config={ctx.config}
          entries={ctx.allEntries.map(({ id: entryId, name, withdrawn, createdAt }) => ({
            id: entryId,
            name,
            withdrawn,
            createdAt,
          }))}
        />
      )}
    </div>
  );
}
