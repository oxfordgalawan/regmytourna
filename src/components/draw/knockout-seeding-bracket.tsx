"use client";

import { useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { entriesFromKnockoutSlots, seedOrder, seededPairs } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";

type Entry = { id: string; name: string };

export function KnockoutSeedingBracket({
  entries,
  slots,
  onChange,
  readOnly = false,
}: {
  entries: Entry[];
  slots: (string | null)[];
  onChange: (slots: (string | null)[]) => void;
  readOnly?: boolean;
}) {
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const placed = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const unassigned = entries.filter((e) => !placed.has(e.id));

  const engineEntries = useMemo(
    () => entriesFromKnockoutSlots(slots, entries.map((e) => ({ id: e.id, name: e.name }))),
    [slots, entries]
  );
  const pairs = useMemo(() => seededPairs(engineEntries), [engineEntries]);
  const bracketOrder = useMemo(() => seedOrder(Math.max(slots.length, 2)), [slots.length]);

  const [dragging, setDragging] = useState<string | null>(null);
  const slotRefs = useRef(new Map<number, HTMLDivElement>());
  const unassignedRef = useRef<HTMLDivElement>(null);

  function assignToSlot(seedIndex: number, entryId: string | null) {
    if (readOnly) return;
    const next = [...slots];
    while (next.length <= seedIndex) next.push(null);
    const prevAt = next[seedIndex];
    if (entryId) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] === entryId) next[i] = null;
      }
    }
    next[seedIndex] = entryId;
    if (prevAt && entryId && prevAt !== entryId) {
      // displaced entry becomes unassigned (already cleared from other slots)
    }
    onChange(next);
  }

  function hitTarget(clientX: number, clientY: number): number | "unassigned" | null {
    const u = unassignedRef.current?.getBoundingClientRect();
    if (u && clientX >= u.left && clientX <= u.right && clientY >= u.top && clientY <= u.bottom) {
      return "unassigned";
    }
    for (const [idx, el] of slotRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return idx;
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
    const t = hitTarget(e.clientX, e.clientY);
    if (t === "unassigned") {
      const idx = slots.indexOf(dragging);
      if (idx >= 0) assignToSlot(idx, null);
      return;
    }
    if (typeof t === "number") assignToSlot(t, dragging);
  }
  function onPointerUp() {
    setDragging(null);
  }

  function Slot({ seedIndex }: { seedIndex: number }) {
    const id = seedIndex < slots.length ? slots[seedIndex] : null;
    const name = id ? byId.get(id)?.name : null;
    return (
      <div
        ref={(el) => {
          if (el) slotRefs.current.set(seedIndex, el);
          else slotRefs.current.delete(seedIndex);
        }}
        className={cn(
          "rounded-lg border border-line bg-ink/50 px-2 py-1.5",
          !name && "border-dashed"
        )}
      >
        <p className="font-mono text-[0.6rem] text-brass">Seed {seedIndex + 1}</p>
        <p className={cn("truncate text-xs", name ? "text-bone" : "text-muted-foreground")}>
          {name ?? "Bye / empty"}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-6 lg:flex-row select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-sm text-muted-foreground">First round — drag teams onto seed lines. Empty lines become byes.</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {pairs.map((pair, pi) => (
            <div key={pi} className="flex w-40 shrink-0 flex-col gap-1 rounded-xl border border-line bg-surface p-2">
              <p className="eyebrow mb-1 text-center">Match {pi + 1}</p>
              <Slot seedIndex={bracketOrder[pi * 2] - 1} />
              <Slot seedIndex={bracketOrder[pi * 2 + 1] - 1} />
            </div>
          ))}
        </div>
      </div>

      <div
        ref={unassignedRef}
        className="w-full shrink-0 rounded-xl border border-dashed border-line bg-espresso/20 p-3 lg:w-56"
      >
        <p className="mb-2 font-semibold text-bone">Unassigned</p>
        <div className="flex flex-col gap-1.5">
          {unassigned.map((e) => (
            <div
              key={e.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-line bg-ink/50 px-2 py-1.5 text-sm",
                dragging === e.id && "ring-1 ring-brass"
              )}
            >
              {!readOnly && (
                <button
                  type="button"
                  onPointerDown={(ev) => onPointerDown(ev, e.id)}
                  className="cursor-grab touch-none text-muted-foreground"
                  aria-label={`Drag ${e.name}`}
                >
                  <GripVertical className="size-3.5" />
                </button>
              )}
              <span className="truncate text-bone">{e.name}</span>
            </div>
          ))}
          {unassigned.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Everyone is on the bracket</p>
          )}
        </div>
      </div>
    </div>
  );
}
