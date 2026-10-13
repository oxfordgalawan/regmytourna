"use client";

import { startTransition, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, GripVertical, ListRestart, Loader2, Shuffle, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { saveSeedsAction, withdrawEntryAction } from "@/app/actions/draw";
import { Button } from "@/components/ui/button";
import { poolSizes, type BracketConfig } from "@/lib/bracket-format";
import { POOL_LETTERS, shuffle, snakePools } from "@/lib/bracket-engine";
import { seededPairs } from "@/lib/bracket-engine/elimination";
import { cn } from "@/lib/utils";

type SeedEntry = { id: string; name: string; withdrawn: boolean; createdAt: string };

/** Where each seed lands: "Pool B" or "vs #8" / "Bye". */
function landing(order: SeedEntry[], config: BracketConfig) {
  const where = new Map<string, string>();
  const entries = order.map(({ id, name }) => ({ id, name }));
  if (config.pools && entries.length > config.pools.size) {
    snakePools(entries, poolSizes(entries.length, config.pools.size)).forEach((members, i) =>
      members.forEach((e) => where.set(e.id, `Pool ${POOL_LETTERS[i]}`))
    );
  } else if (config.final.type === "single_elimination" || config.final.type === "double_elimination") {
    const seedOf = new Map(entries.map((e, i) => [e.id, i + 1]));
    for (const [x, y] of seededPairs(entries)) {
      if (x) where.set(x.id, y ? `vs #${seedOf.get(y.id)}` : "Bye");
      if (y) where.set(y.id, x ? `vs #${seedOf.get(x.id)}` : "Bye");
    }
  }
  return where;
}

export function SeedingBoard({
  divisionId,
  entries,
  config,
}: {
  divisionId: string;
  entries: SeedEntry[];
  config: BracketConfig;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(() => entries.filter((e) => !e.withdrawn));
  const [dragging, setDragging] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const timer = useRef<number | undefined>(undefined);
  const withdrawn = entries.filter((e) => e.withdrawn);
  const where = useMemo(() => landing(order, config), [order, config]);

  // pick up server changes (e.g. after a withdrawal) without losing local edits otherwise
  const serverKey = entries.map((e) => `${e.id}:${e.withdrawn}`).join(",");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setOrder(entries.filter((e) => !e.withdrawn));
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function persist(next: SeedEntry[]) {
    window.clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = window.setTimeout(async () => {
      const res = await saveSeedsAction(divisionId, [...next, ...withdrawn].map((e) => e.id));
      if (res.error) {
        toast.error(res.error);
        setSaveState("idle");
      } else setSaveState("saved");
    }, 600);
  }

  function reorder(next: SeedEntry[], animate = false) {
    if (animate) startTransition(() => setOrder(next));
    else setOrder(next);
    persist(next);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next, true);
  }

  // pointer-based drag (works with mouse, pen and touch)
  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const from = order.findIndex((x) => x.id === dragging);
    let to = from;
    order.forEach((entry, i) => {
      const el = rowRefs.current.get(entry.id);
      if (!el || entry.id === dragging) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (i < from && e.clientY < mid) to = Math.min(to, i);
      if (i > from && e.clientY > mid) to = Math.max(to, i);
    });
    if (to !== from) {
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setOrder(next);
    }
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(null);
    persist(order);
  }

  async function toggleWithdraw(id: string, withdraw: boolean) {
    const res = await withdrawEntryAction(id, withdraw);
    if (res.error) return toast.error(res.error);
    toast.success(withdraw ? "Entry withdrawn" : "Entry reinstated");
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-bone">Seeding</h3>
          <p className="text-sm text-muted-foreground">
            Drag to set the order — #1 is your strongest. Top seeds are kept apart in the draw.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex min-w-16 items-center gap-1 font-mono text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
            {saveState === "saved" && <Check className="size-3 text-brass" />}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              reorder([...order].sort((x, y) => x.createdAt.localeCompare(y.createdAt)), true)
            }
          >
            <ListRestart />
            Registration order
          </Button>
          <Button size="sm" variant="outline" onClick={() => reorder(shuffle(order), true)}>
            <Shuffle />
            Shuffle
          </Button>
        </div>
      </div>

      {order.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          No confirmed entries yet. Paid registrations appear here automatically.
        </p>
      ) : (
        <ol
          className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface select-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {order.map((entry, i) => (
            <ViewTransition key={entry.id} name={`seed-${entry.id}`} share="auto" default="none" update="vt-fade">
              <li
                ref={(el) => {
                  if (el) rowRefs.current.set(entry.id, el);
                  else rowRefs.current.delete(entry.id);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-colors",
                  dragging === entry.id ? "relative z-10 bg-umber/40 shadow-xl" : "hover:bg-espresso/40"
                )}
              >
                <button
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, entry.id)}
                  className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:text-bone active:cursor-grabbing"
                  aria-label={`Drag to reorder ${entry.name}`}
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="display w-8 text-right text-xl text-brass tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-bone">{entry.name}</span>
                {where.get(entry.id) && (
                  <span className="hidden rounded-full border border-line px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground sm:inline">
                    {where.get(entry.id)}
                  </span>
                )}
                <span className="flex">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${entry.name} up`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-espresso hover:text-bone disabled:opacity-25"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${entry.name} down`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-espresso hover:text-bone disabled:opacity-25"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWithdraw(entry.id, true)}
                    aria-label={`Withdraw ${entry.name}`}
                    title="Withdraw"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-rust/15 hover:text-[#e58a72]"
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                </span>
              </li>
            </ViewTransition>
          ))}
        </ol>
      )}

      {withdrawn.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Withdrawn</p>
          <ul className="space-y-1">
            {withdrawn.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-sm">
                <span className="truncate text-muted-foreground line-through">{e.name}</span>
                <Button size="sm" variant="ghost" onClick={() => toggleWithdraw(e.id, false)}>
                  <UserPlus />
                  Reinstate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
