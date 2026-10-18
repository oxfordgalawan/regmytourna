"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initPoolGroupsFromSnake, manualPoolCapacity, POOL_LETTERS } from "@/lib/bracket-engine";
import type { BracketConfig } from "@/lib/bracket-format";
import { cn } from "@/lib/utils";

type Entry = { id: string; name: string };

export type PoolColumnDef = { letter: string; entryIds: string[] };

function ordinalSeed(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th Seed`;
  switch (n % 10) {
    case 1:
      return `${n}st Seed`;
    case 2:
      return `${n}nd Seed`;
    case 3:
      return `${n}rd Seed`;
    default:
      return `${n}th Seed`;
  }
}

type HitTarget = { kind: "unassigned" } | { kind: "column"; col: number; insertAt: number };

export function PoolSeedingBoard({
  entries,
  config,
  columns,
  onChange,
  readOnly = false,
  allowUnassigned = true,
  showToolbar = true,
  seedOf,
}: {
  entries: Entry[];
  config: BracketConfig;
  columns: PoolColumnDef[];
  onChange: (columns: PoolColumnDef[]) => void;
  readOnly?: boolean;
  allowUnassigned?: boolean;
  showToolbar?: boolean;
  /** Global seed (1 = top seed) keyed by entry id. */
  seedOf?: Map<string, number>;
}) {
  const nominalSize = config.pools?.size ?? 4;
  const manualCap = manualPoolCapacity(nominalSize);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const inPools = useMemo(() => {
    const s = new Set<string>();
    for (const g of columns) for (const id of g.entryIds) s.add(id);
    return s;
  }, [columns]);
  const unassigned = entries.filter((e) => !inPools.has(e.id));

  const [dragging, setDragging] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; name: string } | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const unassignedRef = useRef<HTMLDivElement>(null);
  const lastTargetKey = useRef<string | null>(null);

  function moveEntryTo(entryId: string, target: HitTarget) {
    if (readOnly) return;
    const key =
      target.kind === "unassigned"
        ? "u"
        : `${target.col}:${target.insertAt}:${columns.map((c) => c.entryIds.join(",")).join("|")}`;
    if (lastTargetKey.current === key) return;

    const next = columns.map((g) => ({ ...g, entryIds: [...g.entryIds] }));
    const fromCol = next.findIndex((g) => g.entryIds.includes(entryId));
    let fromIdx = -1;
    if (fromCol >= 0) {
      fromIdx = next[fromCol].entryIds.indexOf(entryId);
      next[fromCol].entryIds.splice(fromIdx, 1);
    }

    if (target.kind === "unassigned") {
      if (!allowUnassigned) return;
      lastTargetKey.current = key;
      onChange(next);
      return;
    }

    const col = next[target.col];
    if (!col) return;
    let insertAt = target.insertAt;
    if (fromCol === target.col && fromIdx >= 0 && fromIdx < insertAt) insertAt--;
    insertAt = Math.max(0, Math.min(insertAt, col.entryIds.length));
    if (fromCol !== target.col && col.entryIds.length >= manualCap) return;

    col.entryIds.splice(insertAt, 0, entryId);
    lastTargetKey.current = key;
    onChange(next);
  }

  function hitTarget(clientX: number, clientY: number): HitTarget | null {
    if (allowUnassigned) {
      const u = unassignedRef.current?.getBoundingClientRect();
      if (u && clientX >= u.left && clientX <= u.right && clientY >= u.top && clientY <= u.bottom) {
        return { kind: "unassigned" };
      }
    }
    for (let i = 0; i < columns.length; i++) {
      const el = columnRefs.current.get(`pool-${i}`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;

      const ids = columns[i].entryIds;
      let insertAt = ids.length;
      for (let j = 0; j < ids.length; j++) {
        if (ids[j] === dragging) continue;
        const row = rowRefs.current.get(ids[j]);
        if (!row) continue;
        const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        if (clientY < mid) {
          insertAt = j;
          break;
        }
      }
      return { kind: "column", col: i, insertAt };
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent, id: string, name: string) {
    if (readOnly) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    lastTargetKey.current = null;
    setDragging(id);
    setGhost({ x: e.clientX, y: e.clientY, name });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    const target = hitTarget(e.clientX, e.clientY);
    if (target) moveEntryTo(dragging, target);
  }

  function onPointerUp() {
    setDragging(null);
    setGhost(null);
    lastTargetKey.current = null;
  }

  function addPool() {
    if (readOnly) return;
    const used = new Set(columns.map((c) => c.letter));
    const letter = [...POOL_LETTERS].find((l) => !used.has(l));
    if (!letter) return;
    onChange([...columns, { letter, entryIds: [] }]);
  }

  function removePool(index: number) {
    if (readOnly || columns.length <= 1) return;
    const g = columns[index];
    if (g.entryIds.length > 0) return;
    onChange(columns.filter((_, i) => i !== index));
  }

  function autoBalance() {
    if (readOnly) return;
    const ordered = entries.map((e) => ({ id: e.id, name: e.name }));
    const groups = initPoolGroupsFromSnake(ordered, config);
    onChange(groups.map((g, i) => ({ letter: columns[i]?.letter ?? POOL_LETTERS[i], entryIds: g.entryIds })));
  }

  function Row({ id, name, positionInPool }: { id: string; name: string; positionInPool: number }) {
    const seed = seedOf?.get(id);
    const isDragging = dragging === id;
    return (
      <div
        ref={(el) => {
          if (el) rowRefs.current.set(id, el);
          else rowRefs.current.delete(id);
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-line bg-ink/50 px-2 py-1.5 text-sm",
          isDragging && "opacity-40"
        )}
      >
        {!readOnly && (
          <button
            type="button"
            onPointerDown={(e) => onPointerDown(e, id, name)}
            className="cursor-grab touch-none text-muted-foreground hover:text-bone active:cursor-grabbing"
            aria-label={`Drag ${name}`}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <span className="display w-7 shrink-0 text-center text-base tabular-nums text-bone">
          {String(positionInPool).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-bone">{name}</p>
          {seed != null && (
            <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{ordinalSeed(seed)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!readOnly && showToolbar && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={autoBalance}>
            <Wand2 />
            Assign groups automatically
          </Button>
          <Button size="sm" variant="outline" onClick={addPool} disabled={columns.length >= POOL_LETTERS.length}>
            <Plus />
            Add pool
          </Button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((group, i) => (
          <div
            key={group.letter}
            ref={(el) => {
              const key = `pool-${i}`;
              if (el) columnRefs.current.set(key, el);
              else columnRefs.current.delete(key);
            }}
            className={cn(
              "flex w-56 shrink-0 flex-col rounded-xl border border-line bg-surface p-3 transition-colors",
              dragging && "ring-1 ring-brass/30",
              !readOnly && group.entryIds.length > nominalSize && "border-brass/40"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-bone">Pool {group.letter}</p>
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  {group.entryIds.length} {group.entryIds.length === 1 ? "Participant" : "Participants"} · target{" "}
                  {nominalSize}
                  {group.entryIds.length > nominalSize ? " (+1 for RR)" : ""}
                </p>
              </div>
              {!readOnly && showToolbar && (
                <button
                  type="button"
                  disabled={group.entryIds.length > 0 || columns.length <= 1}
                  onClick={() => removePool(i)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-rust/15 hover:text-[#e58a72] disabled:opacity-25"
                  title="Delete empty pool"
                  aria-label={`Delete pool ${group.letter}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex min-h-24 flex-col gap-1.5">
              {group.entryIds.map((id, idx) => {
                const e = byId.get(id);
                return e ? <Row key={id} id={id} name={e.name} positionInPool={idx + 1} /> : null;
              })}
              {group.entryIds.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">Drop teams here</p>
              )}
            </div>
          </div>
        ))}

        {allowUnassigned && (
          <div
            ref={unassignedRef}
            className="flex w-56 shrink-0 flex-col rounded-xl border border-dashed border-line bg-espresso/20 p-3"
          >
            <p className="mb-2 font-semibold text-bone">Unassigned</p>
            <p className="mb-2 font-mono text-[0.65rem] text-muted-foreground">{unassigned.length} teams</p>
            <div className="flex min-h-24 flex-col gap-1.5">
              {unassigned.map((e, idx) => (
                <Row key={e.id} id={e.id} name={e.name} positionInPool={idx + 1} />
              ))}
              {unassigned.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">All teams placed</p>
              )}
            </div>
          </div>
        )}
      </div>

      {ghost &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[100] flex max-w-[14rem] items-center gap-2 rounded-lg border border-brass bg-surface px-2 py-1.5 text-sm shadow-xl ring-1 ring-brass/50"
            style={{ left: ghost.x + 12, top: ghost.y + 12 }}
          >
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-bone">{ghost.name}</span>
          </div>,
          document.body
        )}
    </div>
  );
}
