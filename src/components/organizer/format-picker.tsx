"use client";

import { startTransition, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, Sparkles } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { BracketPreview } from "@/components/organizer/bracket-preview";
import {
  FINAL_TYPES,
  FINAL_TYPE_LABELS,
  PRESETS,
  PRESET_IDS,
  TIEBREAKER_LABELS,
  presetConfig,
  recommendedPreset,
  summarize,
  matchGamesToWinHint,
  type BracketConfig,
  type FinalConfig,
  type PoolsConfig,
  type PresetId,
} from "@/lib/bracket-format";
import { cn } from "@/lib/utils";

const MAIN_PRESETS: PresetId[] = ["pools_knockout", "knockout", "double_knockout", "round_robin"];
const MORE_PRESETS: PresetId[] = PRESET_IDS.filter((p) => !MAIN_PRESETS.includes(p));

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <span role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-input bg-ink/40 p-0.5 align-middle">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors duration-200",
            value === o.value ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line p-4 transition-colors hover:border-bone/25">
      <span>
        <span className="block text-sm font-medium text-bone">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone peer-focus-visible:ring-2 peer-focus-visible:ring-brass" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
      </span>
    </label>
  );
}

/**
 * Plain-language bracket format chooser. Every number shown is computed for
 * `teams`, so organizers see the consequence of a choice before making it.
 */
export function FormatPicker({
  value,
  onChange,
  teams,
  noun = "teams",
  showPreview = true,
}: {
  value: BracketConfig;
  onChange: (next: BracketConfig) => void;
  teams: number;
  /** "teams" or "players" */
  noun?: string;
  showPreview?: boolean;
}) {
  const [showMore, setShowMore] = useState(MORE_PRESETS.includes(value.preset));
  const recommended = recommendedPreset(teams);
  const summary = summarize(value, teams);

  // run as a transition so the preview animates between shapes
  const set = (next: BracketConfig) => startTransition(() => onChange(next));
  const setPools = (patch: Partial<PoolsConfig>) =>
    value.pools && set({ ...value, pools: { ...value.pools, ...patch } });
  const setFinal = (patch: Partial<FinalConfig>) => set({ ...value, final: { ...value.final, ...patch } });

  const f = value.final;
  const isKnockout = f.type === "single_elimination" || f.type === "double_elimination";
  // standings exist for pools, round robin and Swiss
  const hasRanking = Boolean(value.pools) || f.type === "round_robin" || f.type === "swiss";
  const moveTiebreaker = (index: number, delta: -1 | 1) => {
    const list = [...value.tiebreakers];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    set({ ...value, tiebreakers: list });
  };

  const presetCard = (id: PresetId) => {
    const active = value.preset === id;
    const cfg = active ? value : presetConfig(id, teams);
    const s = summarize(cfg, teams);
    const range = s.totalMatches === s.totalMatchesMax ? `${s.totalMatches}` : `${s.totalMatches}–${s.totalMatchesMax}`;
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() =>
          !active && set({ ...presetConfig(id, teams), gamesToWin: value.gamesToWin ?? 2 })
        }
        className={cn(
          "relative flex flex-col rounded-xl border p-4 text-left transition-all duration-200",
          active ? "border-bone bg-bone text-ink" : "border-line text-bone hover:border-bone/40 hover:bg-espresso/40"
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold">{PRESETS[id].label}</span>
          {id === recommended && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.6rem] tracking-wider uppercase",
                active ? "bg-ink/10 text-ink" : "bg-brass/15 text-brass"
              )}
            >
              <Sparkles className="size-3" /> Best fit
            </span>
          )}
          {active && <Check className="ml-auto size-4" strokeWidth={3} />}
        </span>
        <span className={cn("mt-1.5 text-xs leading-relaxed", active ? "text-ink/70" : "text-muted-foreground")}>
          {PRESETS[id].tagline}
        </span>
        <span
          className={cn(
            "mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 font-mono text-[0.7rem]",
            active ? "border-ink/15 text-ink/80" : "border-line text-bone/70"
          )}
        >
          <span>{range} matches</span>
          <span>{s.guaranteedGames}+ games each</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Pick a format */}
      <div>
        <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-2">
          {MAIN_PRESETS.map(presetCard)}
          {showMore && MORE_PRESETS.map(presetCard)}
        </div>
        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-bone"
          >
            <ChevronDown className="size-4" /> More formats (Swiss, custom)
          </button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {PRESETS[value.preset].bestFor}. Numbers are for {teams} {noun}.
        </p>
      </div>

      {/* 2. Settings, written as sentences */}
      <div className="space-y-4 rounded-xl border border-line bg-ink/30 p-4 text-sm leading-[2.6] text-bone/85">
        {value.preset === "custom" && (
          <p>
            Start with{" "}
            <Segmented
              label="First stage"
              value={value.pools ? "pools" : "none"}
              options={[
                { value: "pools", label: "pools" },
                { value: "none", label: "no pools" },
              ]}
              onChange={(v) =>
                set({
                  ...value,
                  pools: v === "pools" ? { size: 4, advance: 2, playEachOther: 1 } : null,
                })
              }
            />
            , then finish with{" "}
            <Segmented
              label="Final stage"
              value={f.type}
              options={FINAL_TYPES.map((t) => ({ value: t, label: FINAL_TYPE_LABELS[t].toLowerCase() }))}
              onChange={(type) => setFinal({ type })}
            />
            .
          </p>
        )}

        {value.pools && (
          <p>
            Pools of{" "}
            <Stepper compact label="pool size" min={3} max={20} value={value.pools.size} onChange={(size) => setPools({ size, advance: Math.min(value.pools!.advance, size - 1) })} />{" "}
            → top{" "}
            <Stepper
              compact
              label="teams advancing per pool"
              min={1}
              max={Math.max(1, value.pools.size - 1)}
              value={value.pools.advance}
              onChange={(advance) => setPools({ advance })}
            />{" "}
            from each pool go through · meet each opponent{" "}
            <Segmented
              label="Meet each opponent"
              value={value.pools.playEachOther}
              options={[
                { value: 1, label: "once" },
                { value: 2, label: "twice" },
              ]}
              onChange={(playEachOther) => setPools({ playEachOther })}
            />
          </p>
        )}
        {value.pools && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-bone">
              {(value.pools.size - 1) * value.pools.playEachOther} matches per team
            </span>{" "}
            ·{" "}
            <span className="font-semibold text-bone">
              {summary.poolScheduleRoundsPerPool ?? 0} schedule{" "}
              {(summary.poolScheduleRoundsPerPool ?? 0) === 1 ? "round" : "rounds"}
            </span>{" "}
            per pool (each team plays once per schedule round — not a rematch for ties).
          </p>
        )}

        {f.type === "round_robin" && (
          <p>
            Everyone meets each opponent{" "}
            <Segmented
              label="Meet each opponent"
              value={f.playEachOther}
              options={[
                { value: 1, label: "once" },
                { value: 2, label: "twice" },
              ]}
              onChange={(playEachOther) => setFinal({ playEachOther })}
            />
          </p>
        )}

        {f.type === "swiss" && (
          <p>
            Play{" "}
            <Stepper compact label="rounds" min={1} max={20} value={f.rounds} onChange={(rounds) => setFinal({ rounds })} />{" "}
            rounds — each round pairs teams with a similar record.
          </p>
        )}

        {isKnockout && (
          <p className="text-bone/70">
            {summary.advancing} {noun} in the {FINAL_TYPE_LABELS[f.type].toLowerCase()}
            {summary.byes > 0 ? ` (${summary.byes} first-round ${summary.byes === 1 ? "bye" : "byes"})` : ""}.
          </p>
        )}

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-center leading-normal">
          {[
            { k: "Matches", v: summary.totalMatches === summary.totalMatchesMax ? summary.totalMatches : `${summary.totalMatches}–${summary.totalMatchesMax}` },
            { k: "Games guaranteed", v: summary.guaranteedGames },
            {
              k: value.pools ? "Schedule rounds (per pool)" : "Rounds",
              v: value.pools
                ? (summary.poolScheduleRoundsPerPool ?? "—")
                : f.type === "swiss"
                  ? f.rounds
                  : "—",
            },
          ].map((stat) => (
            <div key={stat.k} className="bg-surface px-3 py-3">
              <p className="display text-3xl text-bone tabular-nums">{stat.v}</p>
              <p className="eyebrow mt-1">{stat.k}</p>
            </div>
          ))}
        </div>
      </div>

      {summary.warnings.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {summary.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-lg border border-brass/30 bg-brass/5 px-3 py-2 text-sm text-brass">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {showPreview && <BracketPreview config={value} teams={teams} />}

      {/* 3. Fine-tune */}
      <details className="group rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-bone">
          Fine-tune
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-line p-4">
          <div>
            <p className="text-sm font-medium">Match scoring</p>
            <p className="mb-3 text-xs text-muted-foreground">How many games a team must win to take the match.</p>
            <Segmented
              label="Games to win the match"
              value={value.gamesToWin ?? 2}
              options={[
                { value: 1, label: "1" },
                { value: 2, label: "2" },
                { value: 3, label: "3" },
              ]}
              onChange={(gamesToWin) => set({ ...value, gamesToWin })}
            />
            <p className="mt-2 text-xs text-muted-foreground">{matchGamesToWinHint(value.gamesToWin ?? 2)}</p>
          </div>

          {hasRanking && (
            <div>
              <p className="text-sm font-medium">Breaking ties in the standings</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Checked top to bottom until tied teams are separated. Use the arrows to reorder.
              </p>
              <ol className="space-y-1.5">
                {value.tiebreakers.map((t, i) => (
                  <li
                    key={t}
                    className="flex items-center gap-3 rounded-lg border border-line bg-ink/30 px-3 py-2 transition-colors"
                  >
                    <span className="font-mono text-xs text-brass">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-bone">{TIEBREAKER_LABELS[t].label}</span>
                      <span className="block text-xs text-muted-foreground">{TIEBREAKER_LABELS[t].hint}</span>
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveTiebreaker(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${TIEBREAKER_LABELS[t].label} up`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-espresso hover:text-bone disabled:opacity-25"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTiebreaker(i, 1)}
                        disabled={i === value.tiebreakers.length - 1}
                        aria-label={`Move ${TIEBREAKER_LABELS[t].label} down`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-espresso hover:text-bone disabled:opacity-25"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {f.type === "single_elimination" && (
            <Switch
              checked={f.thirdPlaceMatch}
              onChange={(thirdPlaceMatch) => setFinal({ thirdPlaceMatch })}
              label="Bronze medal match"
              hint="The two losing semi-finalists play for 3rd place."
            />
          )}

          {f.type === "double_elimination" && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Grand final</p>
                <div className="grid gap-2">
                  {(
                    [
                      ["reset", "Fair final", "The losers'-side finalist must beat the champion twice (they've lost once already)."],
                      ["single", "One final match", "Winner takes all, even if it's their first loss."],
                      ["none", "No grand final", "The winners'-side finalist is champion."],
                    ] as const
                  ).map(([v, label, hint]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={f.grandFinal === v}
                      onClick={() => setFinal({ grandFinal: v })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        f.grandFinal === v ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                      )}
                    >
                      <span className="block text-sm text-bone">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {f.type === "swiss" && (
            <p className="text-sm leading-[2.6] text-bone/85">
              A win is worth{" "}
              <Stepper compact label="points per win" min={0} max={10} value={f.matchWinPoints} onChange={(matchWinPoints) => setFinal({ matchWinPoints })} />{" "}
              point(s).
            </p>
          )}

          {!hasRanking && !isKnockout && f.type !== "swiss" && (
            <p className="text-sm text-muted-foreground">Nothing else to adjust for this format.</p>
          )}
        </div>
      </details>
    </div>
  );
}
