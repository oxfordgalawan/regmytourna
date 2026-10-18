"use client";

import { useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initPoolGroupsFromSnake, POOL_LETTERS } from "@/lib/bracket-engine";
import type { BracketConfig } from "@/lib/bracket-format";
import { cn } from "@/lib/utils";

type Entry = { id: string; name: string };

export type PoolColumnDef = { letter: string; entryIds: string[] };

export function PoolSeedingBoard({
  entries,
  config,
  columns,
  onChange,
  readOnly = false,
  allowUnassigned = true,
  showToolbar = true,
}: {
  entries: Entry[];
  config: BracketConfig;
  columns: PoolColumnDef[];
  onChange: (columns: PoolColumnDef[]) => void;
  readOnly?: boolean;
  allowUnassigned?: boolean;
  showToolbar?: boolean;
}) {
  const maxSize = config.pools?.size ?? 4;
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const inPools = useMemo(() => {
    const s = new Set<string>();
    for (const g of columns) for (const id of g.entryIds) s.add(id);
    return s;
  }, [columns]);
  const unassigned = entries.filter((e) => !inPools.has(e.id));

  const [dragging, setDragging] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const unassignedRef = useRef<HTMLDivElement>(null);

  function moveEntry(entryId: string, toColumn: "unassigned" | number) {
    if (readOnly) return;
    const next = columns.map((g) => ({ ...g, entryIds: [...g.entryIds] }));
    for (const g of next) {
      g.entryIds = g.entryIds.filter((id) => id !== entryId);
    }
    if (toColumn === "unassigned") {
      if (allowUnassigned) onChange(next);
      return;
    }
    const col = next[toColumn];
    if (!col) return;
    if (col.entryIds.length >= maxSize) return;
    col.entryIds.push(entryId);
    onChange(next);
  }

  function hitColumn(clientX: number, clientY: number): "unassigned" | number | null {
    if (allowUnassigned) {
      const u = unassignedRef.current?.getBoundingClientRect();
      if (u && clientX >= u.left && clientX <= u.right && clientY >= u.top && clientY <= u.bottom) {
        return "unassigned";
      }
    }
    for (let i = 0; i < columns.length; i++) {
      const key = `pool-${i}`;
      const el = columnRefs.current.get(key);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return i;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (readOnly) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const target = hitColumn(e.clientX, e.clientY);
    if (target === null) return;
    const currentCol = columns.findIndex((g) => g.entryIds.includes(dragging));
    if (target === "unassigned") {
      if (currentCol >= 0 || inPools.has(dragging)) moveEntry(dragging, "unassigned");
      return;
    }
    if (target !== currentCol) moveEntry(dragging, target);
  }
  function onPointerUp() {
    setDragging(null);
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

  function Row({ id, name }: { id: string; name: string }) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-line bg-ink/50 px-2 py-1.5 text-sm",
          dragging === id && "relative z-20 shadow-lg ring-1 ring-brass"
        )}
      >
        {!readOnly && (
          <button
            type="button"
            onPointerDown={(e) => onPointerDown(e, id)}
            className="cursor-grab touch-none text-muted-foreground hover:text-bone active:cursor-grabbing"
            aria-label={`Drag ${name}`}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <span className="min-w-0 flex-1 truncate text-bone">{name}</span>
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
            Auto-balance (snake)
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
            className="flex w-52 shrink-0 flex-col rounded-xl border border-line bg-surface p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-bone">Pool {group.letter}</p>
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  {group.entryIds.length} / {maxSize}
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
              {group.entryIds.map((id) => {
                const e = byId.get(id);
                return e ? <Row key={id} id={id} name={e.name} /> : null;
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
            className="flex w-52 shrink-0 flex-col rounded-xl border border-dashed border-line bg-espresso/20 p-3"
          >
            <p className="mb-2 font-semibold text-bone">Unassigned</p>
            <p className="mb-2 font-mono text-[0.65rem] text-muted-foreground">{unassigned.length} teams</p>
            <div className="flex min-h-24 flex-col gap-1.5">
              {unassigned.map((e) => (
                <Row key={e.id} id={e.id} name={e.name} />
              ))}
              {unassigned.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">All teams placed</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
