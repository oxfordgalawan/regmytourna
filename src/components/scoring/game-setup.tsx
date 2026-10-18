"use client";

import { useState } from "react";
import { Coins, Play } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { MatchTimers, type TimerEvent, type TimerLogFn } from "@/components/scoring/match-timers";
import { Button } from "@/components/ui/button";
import { other, type MatchSetup, type Side } from "@/lib/scoring/pickleball";
import type { CourtPlayer } from "@/lib/scoring/officiating";
import { cn } from "@/lib/utils";

type Team = { side: Side; label: string; players: CourtPlayer[] };

/**
 * Before each game: timers, the coin toss (game 1 only), who serves first and
 * each team's base player. Everything here is saved to the match record.
 */
export function GameSetup({
  game,
  doubles,
  teams,
  setup,
  events,
  onTimer,
  onStart,
}: {
  game: number;
  doubles: boolean;
  teams: [Team, Team];
  setup: MatchSetup | null;
  events: TimerEvent[];
  onTimer: TimerLogFn;
  /** applies the start on this device; returns an error message or null */
  onStart: (input: { tossWinner: Side; firstServe: Side; base: { a: number; b: number } }) => string | null;
}) {
  const firstGame = !setup;
  // later games alternate the first serve from game 1
  const suggestedServe = setup ? (game % 2 === 1 ? (setup.game1Serve ?? setup.firstServe) : other(setup.game1Serve ?? setup.firstServe)) : null;

  const [toss, setToss] = useState<Side | null>(setup?.tossWinner ?? null);
  const [serve, setServe] = useState<Side | null>(suggestedServe);
  const [base, setBase] = useState<{ a: number | null; b: number | null }>(
    doubles ? { a: setup?.base.a ?? null, b: setup?.base.b ?? null } : { a: 0, b: 0 }
  );

  const ready = toss !== null && serve !== null && base.a !== null && base.b !== null;
  const missing = [
    toss === null && "coin toss",
    serve === null && "first serve",
    (base.a === null || base.b === null) && "base players",
  ].filter(Boolean);

  function start() {
    if (!ready) return;
    const error = onStart({ tossWinner: toss!, firstServe: serve!, base: { a: base.a!, b: base.b! } });
    if (error) return toast.error(error);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  const teamName = (s: Side) => teams.find((t) => t.side === s)!.label;

  return (
    <div className="mt-5 flex flex-1 flex-col gap-4">
      <Section step={1} title="Timers" hint="Run what you need. Each run is logged as proof.">
        <MatchTimers events={events} onLog={onTimer} />
      </Section>

      {firstGame && (
        <Section step={2} title="Coin toss" hint="Who won the toss?">
          <p className="mb-2 text-xs text-muted-foreground">Wrong team? Tap the other side before you start the game.</p>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((t) => (
              <Choice
                key={t.side}
                active={toss === t.side}
                onClick={() => {
                  setToss(t.side);
                  if (serve === null) setServe(t.side);
                }}
              >
                <Coins className={cn("size-4 shrink-0", toss === t.side ? "text-ink" : "text-brass")} />
                <span className="truncate">{t.label}</span>
              </Choice>
            ))}
          </div>
        </Section>
      )}

      <Section
        step={firstGame ? 3 : 2}
        title="First serve"
        hint={firstGame ? "Usually the toss winner — unless they chose to receive." : `Game ${game}: teams alternate the first serve.`}
      >
        <div className="grid grid-cols-2 gap-2">
          {teams.map((t) => (
            <Choice key={t.side} active={serve === t.side} onClick={() => setServe(t.side)}>
              <span className={cn("size-3 shrink-0 rounded-full", serve === t.side ? "bg-ink" : "bg-[#d4e157]")} />
              <span className="truncate">{t.label}</span>
            </Choice>
          ))}
        </div>
      </Section>

      {doubles && (
        <Section step={firstGame ? 4 : 3} title="Base players" hint="The player who starts in the right (even) court for each team.">
          <p className="mb-2 text-xs text-muted-foreground">
            Wrong base player? Tap another before you start — or use <strong className="text-bone">Change setup</strong>{" "}
            anytime during the game (resets the score to 0–0).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t.side} className="min-w-0">
                <p className="mb-1.5 truncate text-xs text-muted-foreground">{t.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {t.players.map((p, i) => {
                    const active = base[t.side] === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setBase((b) => ({ ...b, [t.side]: i }))}
                        className={cn(
                          "flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors",
                          active ? "border-bone bg-bone/[0.08]" : "border-line bg-surface hover:border-bone/40"
                        )}
                      >
                        <span className="relative">
                          <PlayerAvatar name={p.name} src={p.avatarUrl} className="size-12" />
                          {active && (
                            <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-bone font-mono text-[0.6rem] font-bold text-ink">
                              B
                            </span>
                          )}
                        </span>
                        <span className="w-full truncate text-center text-sm text-bone">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button size="lg" className="h-14 w-full text-base" disabled={!ready} onClick={start}>
          <Play />
          Start game {game}
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {ready
            ? `${teamName(serve!)} serves · call “0-0${doubles ? "-2" : ""}”`
            : `Still needed: ${missing.join(", ")}`}
        </p>
      </div>
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-espresso/40 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-muted-foreground">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-bone">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
        active ? "border-bone bg-bone text-ink" : "border-line bg-surface text-bone hover:border-bone/40"
      )}
    >
      {children}
    </button>
  );
}
