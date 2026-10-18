"use client";

import { useState, ViewTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, RotateCcw, Timer, Trophy } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { correctResultAction, enterResultAction } from "@/app/actions/draw";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DrawMatchCard } from "@/components/draw/draw-match-card";
import { LivePoolsPanel } from "@/components/draw/live-pools-panel";
import { PoolGroupPanel } from "@/components/draw/pool-group-panel";
import { StandingsTable } from "@/components/draw/standings-table";
import { bestOfFromGamesToWin, gamesToWinFromDivisionConfig, type BracketConfig } from "@/lib/bracket-format";
import type { EngineMatch, StandingRow } from "@/lib/bracket-engine";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { formatCompletedMatchScoreLine } from "@/lib/scoring/match-display-score";
import { cn } from "@/lib/utils";

type Mode = "organizer" | "public";

const DONE = new Set(["completed", "walkover"]);

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col">
      <p className="eyebrow mb-3 whitespace-nowrap">{title}</p>
      <div className="flex flex-1 flex-col justify-around gap-3">{children}</div>
    </div>
  );
}

function byRound(matches: EngineMatch[]) {
  const rounds = new Map<number, EngineMatch[]>();
  for (const m of matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  return [...rounds.entries()]
    .sort(([x], [y]) => x - y)
    .map(([round, list]) => ({ round, list: list.sort((x, y) => x.position - y.position) }));
}

function emptyGameRows(count: number) {
  return Array.from({ length: count }, () => ["", ""]);
}

function MatchDialog({
  match,
  tournamentId,
  gamesToWin,
  onClose,
}: {
  match: EngineMatch | null;
  tournamentId: string;
  gamesToWin: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const gameRowCount = bestOfFromGamesToWin(gamesToWin);
  const [games, setGames] = useState<string[][]>(() => emptyGameRows(gameRowCount));
  const [busy, setBusy] = useState(false);
  const [entering, setEntering] = useState(false);
  if (!match) return null;
  const done = DONE.has(match.status);
  const ready = Boolean(match.a && match.b);
  const resultLine = done ? formatCompletedMatchScoreLine(match, gamesToWin) : null;

  async function save() {
    setBusy(true);
    const parsed = games.map(([a, b]) => [Number(a || 0), Number(b || 0)] as [number, number]);
    const res = await enterResultAction(match!.id, parsed);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Result saved — next match updated");
    onClose();
    router.refresh();
  }

  async function correct() {
    if (!window.confirm("Reopen this match? Its result is cleared and the teams are taken back out of the next match.")) return;
    setBusy(true);
    const res = await correctResultAction(match!.id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Match reopened");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            M{match.matchNumber} · {match.roundLabel}
          </DialogTitle>
          <DialogDescription>
            {match.aLabel} <span className="font-mono text-xs">vs</span> {match.bLabel}
          </DialogDescription>
        </DialogHeader>

        {resultLine ? <p className="font-mono text-sm text-bone">{resultLine}</p> : null}

        {entering && (
          <div className="space-y-2 rounded-xl border border-line bg-ink/30 p-3">
            <div className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
              <span />
              <span className="truncate">{match.aLabel}</span>
              <span className="truncate">{match.bLabel}</span>
            </div>
            {games.map((g, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
                <span className="eyebrow">Game {i + 1}</span>
                {[0, 1].map((side) => (
                  <input
                    key={side}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={g[side]}
                    onChange={(e) =>
                      setGames((all) =>
                        all.map((row, r) => (r === i ? row.map((v, s) => (s === side ? e.target.value : v)) : row))
                      )
                    }
                    aria-label={`Game ${i + 1}, ${side === 0 ? match.aLabel : match.bLabel}`}
                    className="h-10 w-full rounded-lg border border-input bg-ink/40 px-3 text-center font-mono text-bone outline-none focus-visible:border-brass"
                  />
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Leave unused games empty.</p>
          </div>
        )}

        <DialogFooter className="flex-wrap">
          {!done && ready && !entering && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setGames(emptyGameRows(gameRowCount));
                  setEntering(true);
                }}
              >
                <PenLine />
                Enter result
              </Button>
              <Button asChild>
                <Link href={`/umpire/${tournamentId}/match/${match.id}`} transitionTypes={NAV_FORWARD}>
                  <Timer />
                  Score live
                </Link>
              </Button>
            </>
          )}
          {entering && (
            <>
              <Button variant="ghost" onClick={() => setEntering(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Save result
              </Button>
            </>
          )}
          {done && !match.isBye && (
            <Button variant="outline" onClick={correct} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Correct result
            </Button>
          )}
          {!ready && !done && (
            <p className="text-sm text-muted-foreground">Waiting for both teams to be decided.</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Knockout champion once decided (round robin / Swiss winners are top of the table). */
function championOf(matches: EngineMatch[]) {
  const name = (m: EngineMatch) => (m.winner === m.a ? m.aLabel : m.bLabel);
  const gf = matches.find((m) => m.stage === "grand_final");
  const reset = matches.find((m) => m.stage === "grand_final_reset");
  if (reset && DONE.has(reset.status)) return name(reset);
  if (gf) {
    if (!DONE.has(gf.status)) return null;
    // the losers'-side finalist winning forces a decider (if one is configured)
    if (reset && gf.winner !== gf.a) return null;
    return name(gf);
  }
  const final = matches.find((m) => m.stage === "winners" && !m.nextMatchId && DONE.has(m.status));
  return final ? name(final) : null;
}

/**
 * The live draw for one category: pool tables, knockout tree (with losers'
 * lane and finals), or round-robin / Swiss table with rounds.
 */
export function BracketView({
  mode,
  tournamentId,
  divisionId,
  bracketConfig,
  poolsEditable = false,
  matches,
  pools,
  table,
  advance = 0,
  withdrawn = [],
}: {
  mode: Mode;
  tournamentId: string;
  divisionId?: string;
  bracketConfig?: BracketConfig;
  poolsEditable?: boolean;
  matches: EngineMatch[];
  pools: Array<{ letter: string; rows: StandingRow[] }> | null;
  table: StandingRow[] | null;
  advance?: number;
  withdrawn?: string[];
}) {
  const [open, setOpen] = useState<EngineMatch | null>(null);
  const onOpen = mode === "organizer" ? setOpen : undefined;
  const out = new Set(withdrawn);
  const gamesToWin = bracketConfig ? gamesToWinFromDivisionConfig(bracketConfig) : 1;

  const pool = matches.filter((m) => m.stage === "pool");
  const winners = matches.filter((m) => m.stage === "winners");
  const losers = matches.filter((m) => m.stage === "losers");
  const finals = matches.filter((m) => ["third_place", "grand_final", "grand_final_reset"].includes(m.stage));
  const flat = matches.filter((m) => m.stage === "round_robin" || m.stage === "swiss");
  const champion = championOf(matches);

  return (
    <ViewTransition default="vt-fade" update="none">
      <div className="space-y-10">
        {champion && (
          <div className="flex items-center gap-4 rounded-2xl border border-brass/40 bg-brass/10 p-5">
            <Trophy className="size-7 text-brass" />
            <div>
              <p className="eyebrow text-brass">Champion</p>
              <p className="display text-3xl text-bone">{champion}</p>
            </div>
          </div>
        )}

        {pools && pools.length > 0 && (
          <section className="space-y-6">
            {mode === "organizer" && divisionId && bracketConfig && (
              <div
                className={cn(
                  "rounded-2xl border border-line bg-surface p-4",
                  poolsEditable && "sticky top-3 z-20 shadow-md ring-1 ring-brass/20"
                )}
              >
                <h3 className="eyebrow mb-3">Manage pools</h3>
                <LivePoolsPanel
                  divisionId={divisionId}
                  config={bracketConfig}
                  pools={pools}
                  editable={poolsEditable}
                />
              </div>
            )}
            <div className="space-y-4">
              <h3 className="eyebrow">Pool standings &amp; matches</h3>
              <div className="flex flex-col gap-6">
              {pools.map((p) => {
                const letterMatches = pool.filter((m) => m.pool === p.letter);
                return (
                  <PoolGroupPanel
                    key={p.letter}
                    letter={p.letter}
                    rows={p.rows}
                    matches={letterMatches}
                    advance={advance}
                    withdrawn={out}
                    onOpenMatch={onOpen}
                    playedCount={letterMatches.filter((m) => DONE.has(m.status)).length}
                    totalCount={letterMatches.filter((m) => m.status !== "cancelled").length}
                    gamesToWin={gamesToWin}
                  />
                );
              })}
              </div>
            </div>
          </section>
        )}

        {winners.length > 0 && (
          <section className="space-y-4">
            <h3 className="eyebrow">{losers.length ? "Winners' bracket" : "Knockout"}</h3>
            <div className="flex items-stretch gap-6 overflow-x-auto pb-2 scrollbar-none">
              {byRound(winners).map(({ round, list }) => (
                <Column key={round} title={list[0].roundLabel}>
                  {list.map((m) => (
                    <DrawMatchCard key={m.id} m={m} onOpen={onOpen} gamesToWin={gamesToWin} />
                  ))}
                </Column>
              ))}
              {finals.length > 0 && (
                <Column title="Finals">
                  {finals
                    .sort((x, y) => x.matchNumber - y.matchNumber)
                    .map((m) => (
                      <div key={m.id}>
                        <p className="mb-1 font-mono text-[0.6rem] text-muted-foreground">{m.roundLabel}</p>
                        <DrawMatchCard m={m} onOpen={onOpen} gamesToWin={gamesToWin} />
                      </div>
                    ))}
                </Column>
              )}
            </div>
          </section>
        )}

        {losers.length > 0 && (
          <section className="space-y-4">
            <h3 className="eyebrow">Losers&apos; bracket</h3>
            <div className="flex items-stretch gap-6 overflow-x-auto pb-2 scrollbar-none">
              {byRound(losers).map(({ round, list }) => (
                <Column key={round} title={list[0].roundLabel}>
                  {list.map((m) => (
                    <DrawMatchCard key={m.id} m={m} onOpen={onOpen} gamesToWin={gamesToWin} />
                  ))}
                </Column>
              ))}
            </div>
          </section>
        )}

        {flat.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            {table && <StandingsTable title="Standings" rows={table} withdrawn={out} />}
            <div className="space-y-4">
              {byRound(flat).map(({ round, list }) => (
                <div key={round}>
                  <p className="eyebrow mb-2">{list[0].roundLabel}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((m) => (
                      <DrawMatchCard key={m.id} m={m} onOpen={onOpen} compact gamesToWin={gamesToWin} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {open && (
        <MatchDialog
          match={open}
          tournamentId={tournamentId}
          gamesToWin={gamesToWin}
          onClose={() => setOpen(null)}
        />
      )}
    </ViewTransition>
  );
}
