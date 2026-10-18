import type { EngineMatch } from "@/lib/bracket-engine";
import { matchSideDisplayScore } from "@/lib/scoring/match-display-score";
import { cn } from "@/lib/utils";

const DONE = new Set(["completed", "walkover"]);

export function DrawMatchCard({
  m,
  onOpen,
  compact = false,
  gamesToWin = 1,
}: {
  m: EngineMatch;
  onOpen?: (m: EngineMatch) => void;
  compact?: boolean;
  gamesToWin?: number;
}) {
  const live = m.status === "in_progress";
  const done = DONE.has(m.status);
  const hidden = m.isBye || m.status === "cancelled";
  const sides = [
    { id: m.a, label: m.aLabel, side: "a" as const },
    { id: m.b, label: m.bLabel, side: "b" as const },
  ];
  const clickable = Boolean(onOpen) && !hidden && !(m.isConditional && !m.a);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1 font-mono text-[0.6rem] text-muted-foreground">
        <span>M{m.matchNumber}</span>
        {live ? (
          <span className="flex items-center gap-1 text-rust">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-current" /> Live
          </span>
        ) : m.status === "walkover" ? (
          <span>W/O</span>
        ) : m.isBye ? (
          <span>Bye</span>
        ) : null}
      </div>
      {sides.map((s, i) => {
        const won = done && m.winner && s.id === m.winner;
        const lost = done && m.winner && s.id && s.id !== m.winner;
        const placeholder = !s.id;
        const display = matchSideDisplayScore(m, s.side, gamesToWin);
        return (
          <div key={i} className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5", i === 0 && "border-b border-line")}>
            <span
              className={cn(
                "truncate text-xs",
                won ? "font-semibold text-bone" : lost ? "text-muted-foreground" : "text-bone/85",
                placeholder && "font-mono text-[0.65rem] text-muted-foreground/70"
              )}
            >
              {s.label}
            </span>
            {display.show && !m.isBye && (
              <span className={cn("shrink-0 font-mono text-xs", won ? "text-brass" : "text-muted-foreground")}>
                {display.text}
              </span>
            )}
          </div>
        );
      })}
    </>
  );

  const cls = cn(
    "block overflow-hidden rounded-lg border text-left transition-all",
    compact ? "w-full" : "w-44",
    hidden ? "border-dashed border-line opacity-40" : live ? "border-rust/60 bg-espresso" : done ? "border-line bg-surface" : "border-line bg-ink/60",
    clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-umber"
  );

  return clickable ? (
    <button type="button" className={cls} onClick={() => onOpen!(m)}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
