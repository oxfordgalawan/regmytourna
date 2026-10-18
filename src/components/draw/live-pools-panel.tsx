"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { saveLivePoolLayoutAction } from "@/app/actions/draw";
import { PoolSeedingBoard, type PoolColumnDef } from "@/components/draw/pool-seeding-board";
import type { BracketConfig } from "@/lib/bracket-format";
import type { StandingRow } from "@/lib/bracket-engine";

export function LivePoolsPanel({
  divisionId,
  config,
  pools,
  editable,
}: {
  divisionId: string;
  config: BracketConfig;
  pools: Array<{ letter: string; rows: StandingRow[] }>;
  editable: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<PoolColumnDef[]>(() =>
    pools.map((p) => ({ letter: p.letter, entryIds: p.rows.map((r) => r.id) }))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | undefined>(undefined);

  const poolKey = pools.map((p) => `${p.letter}:${p.rows.map((r) => r.id).join(",")}`).join("|");
  const [seenKey, setSeenKey] = useState(poolKey);
  if (seenKey !== poolKey) {
    setSeenKey(poolKey);
    setColumns(pools.map((p) => ({ letter: p.letter, entryIds: p.rows.map((r) => r.id) })));
  }

  const entries = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pools) for (const r of p.rows) map.set(r.id, r.name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [pools]);

  const seedOf = useMemo(() => {
    const m = new Map<string, number>();
    let seed = 1;
    for (const p of pools) {
      for (const r of p.rows) {
        if (!m.has(r.id)) m.set(r.id, seed++);
      }
    }
    return m;
  }, [pools]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function persist(next: PoolColumnDef[]) {
    setColumns(next);
    if (!editable) return;
    window.clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = window.setTimeout(async () => {
      const res = await saveLivePoolLayoutAction(
        divisionId,
        next.map((c) => ({ pool: c.letter, entryIds: c.entryIds }))
      );
      if (res.error) {
        toast.error(res.error);
        setSaveState("idle");
        router.refresh();
        return;
      }
      setSaveState("saved");
      router.refresh();
    }, 500);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {editable ? (
            <>
              Drag teams between pools. Pool schedule updates automatically while{" "}
              <strong className="text-bone">no pool match has been played</strong>.
            </>
          ) : (
            <>
              Pool play has started — use <strong className="text-bone">Reset draw</strong> to rearrange groups.
            </>
          )}
        </p>
        <span className="flex min-w-16 items-center gap-1 font-mono text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
          {saveState === "saved" && <Check className="size-3 text-brass" />}
          {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>
      <PoolSeedingBoard
        entries={entries}
        config={config}
        columns={columns}
        onChange={persist}
        readOnly={!editable}
        allowUnassigned={false}
        showToolbar={editable}
        seedOf={seedOf}
      />
    </div>
  );
}
