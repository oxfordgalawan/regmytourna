"use client";

import { PlayerAvatar } from "@/components/players/player-avatar";
import { courtSide, other, scoreCall, type ServeState, type Side } from "@/lib/scoring/pickleball";
import type { CourtPlayer } from "@/lib/scoring/officiating";
import { cn } from "@/lib/utils";

type Team = { side: Side; label: string; players: CourtPlayer[]; games: number };

/**
 * A top-down pickleball court. Team B plays from the top, team A from the
 * bottom; each team's "right" court is on their own right as they face the net.
 */
export function PickleballBoard({
  state,
  scores,
  teams,
  base,
  lastCall,
}: {
  state: ServeState;
  scores: { a: number; b: number };
  teams: { a: Team; b: Team };
  base: { a: number; b: number } | null;
  /** the last call ("Side out"…) — key changes replay the animation */
  lastCall: { text: string; key: string | number } | null;
}) {
  const serving = state.serving;
  const receiving = other(serving);
  const serverSide = courtSide(state, scores, serving, state.serverIdx);

  /** screen x (%) for a team's right/left court */
  const x = (team: Side, side: "right" | "left") => (team === "a" ? (side === "right" ? 75 : 25) : side === "right" ? 25 : 75);

  return (
    <div className="flex flex-col gap-3">
      {/* the score call */}
      <div className="flex items-end justify-between gap-3 rounded-2xl border border-line bg-espresso px-4 py-3">
        <div className="min-w-0">
          <p className="eyebrow">Call the score</p>
          <p key={scoreCall(state, scores)} className="display animate-flip text-6xl leading-none text-bone tabular-nums sm:text-7xl">
            {scoreCall(state, scores)}
          </p>
        </div>
        <div className="text-right text-[0.65rem] leading-relaxed text-muted-foreground uppercase">
          <p>Serving</p>
          <p>Receiving</p>
          {state.doubles && <p>Server #</p>}
        </div>
      </div>

      <TeamStrip team={teams.b} score={scores.b} serving={serving === "b"} server={state.doubles ? state.server : null} />

      {/* court */}
      <div className="relative aspect-[20/30] max-h-[52dvh] w-full overflow-hidden rounded-xl border-2 border-bone/70 bg-[#1d4a47] sm:aspect-[20/26]">
        {/* lines: kitchens (7ft of 22ft each side ≈ 31.8%), centre lines, net */}
        <div className="absolute inset-x-0 top-[34.1%] bottom-[34.1%] bg-[#173d3a]" />
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-bone/90 shadow-[0_0_0_3px_rgba(0,0,0,0.25)]" />
        <div className="absolute inset-x-0 top-[34.1%] h-px bg-bone/70" />
        <div className="absolute inset-x-0 bottom-[34.1%] h-px bg-bone/70" />
        <div className="absolute top-0 left-1/2 h-[34.1%] w-px -translate-x-1/2 bg-bone/70" />
        <div className="absolute bottom-0 left-1/2 h-[34.1%] w-px -translate-x-1/2 bg-bone/70" />
        <span className="absolute top-1/2 left-2 -translate-y-[160%] font-mono text-[0.55rem] tracking-widest text-bone/40 uppercase">Kitchen</span>
        <span className="absolute top-1/2 left-2 translate-y-[60%] font-mono text-[0.55rem] tracking-widest text-bone/40 uppercase">Kitchen</span>

        {/* the receiving box: crosscourt from the server */}
        <div
          className="absolute h-[34.1%] w-1/2 bg-[#d4e157]/10 transition-all duration-500"
          style={{
            left: `${x(receiving, serverSide) - 25}%`,
            top: receiving === "b" ? 0 : undefined,
            bottom: receiving === "a" ? 0 : undefined,
          }}
        />

        {(["a", "b"] as const).map((team) =>
          teams[team].players.map((p, idx) => {
            const side = courtSide(state, scores, team, idx);
            const isServer = team === serving && idx === state.serverIdx;
            const isReceiver =
              team === receiving && (state.doubles ? side === serverSide : true);
            const isBase = state.doubles && base?.[team] === idx;
            // in singles only the playing side is drawn
            return (
              <div
                key={`${team}-${idx}`}
                className="absolute flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-[left,top] duration-500 ease-out"
                style={{ left: `${x(team, side)}%`, top: team === "a" ? "83%" : "17%" }}
              >
                <span className="relative">
                  <PlayerAvatar
                    name={p.name}
                    src={p.avatarUrl}
                    className={cn(
                      "size-14 sm:size-16",
                      isServer ? "ring-4 ring-[#d4e157]" : isReceiver ? "ring-2 ring-bone/60" : "ring-2 ring-black/30"
                    )}
                  />
                  {isServer && (
                    <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#d4e157] shadow" aria-label="Serving">
                      <span className="size-2 rounded-full bg-[#9aa53a]" />
                    </span>
                  )}
                  {isBase && (
                    <span className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-bone font-mono text-[0.6rem] font-bold text-ink" title="Base player">
                      B
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium",
                    isServer ? "bg-[#d4e157] text-ink" : "bg-black/35 text-bone"
                  )}
                >
                  {p.name.split(/\s+/)[0]}
                  {isServer && state.doubles ? ` · S${state.server}` : ""}
                </span>
              </div>
            );
          })
        )}

        {lastCall && (
          <span
            key={lastCall.key}
            className="animate-rise absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/90 px-3 py-1 font-mono text-xs tracking-wide text-bone uppercase shadow-lg"
          >
            {lastCall.text}
          </span>
        )}
      </div>

      <TeamStrip team={teams.a} score={scores.a} serving={serving === "a"} server={state.doubles ? state.server : null} />
    </div>
  );
}

function TeamStrip({ team, score, serving, server }: { team: Team; score: number; serving: boolean; server: number | null }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
        serving ? "border-[#d4e157]/50 bg-[#d4e157]/[0.07]" : "border-line bg-surface"
      )}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full", serving ? "bg-[#d4e157]" : "bg-line")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-bone">{team.label}</p>
        <p className="text-xs text-muted-foreground">
          {serving ? (server ? `Serving · server ${server}` : "Serving") : "Receiving"}
          {" · "}
          {team.games} {team.games === 1 ? "game" : "games"}
        </p>
      </div>
      <span key={score} className="display animate-flip text-4xl text-bone tabular-nums">
        {score}
      </span>
    </div>
  );
}
