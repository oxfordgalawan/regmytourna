"use client";

import { startTransition, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ListRestart,
  Loader2,
  Shuffle,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { saveSeedingLayoutAction, saveSeedsAction, withdrawEntryAction } from "@/app/actions/draw";
import { Button } from "@/components/ui/button";
import { KnockoutSeedingBracket } from "@/components/draw/knockout-seeding-bracket";
import { PoolSeedingBoard, type PoolColumnDef } from "@/components/draw/pool-seeding-board";
import {
  initKnockoutSlotsFromOrder,
  initPoolGroupsFromSnake,
  mergeLayoutWithEntries,
  POOL_LETTERS,
  seededPairs,
  shuffle,
  usesKnockoutSlotSeeding,
  usesMultiPool,
  type PoolGroup,
  type SeedingLayout,
} from "@/lib/bracket-engine";
import type { BracketConfig } from "@/lib/bracket-format";
import { cn } from "@/lib/utils";

type SeedEntry = { id: string; name: string; withdrawn: boolean; createdAt: string };

type Tab = "list" | "pools" | "bracket";

function landing(order: SeedEntry[], config: BracketConfig, layout: SeedingLayout) {
  const where = new Map<string, string>();
  const entries = order.map(({ id, name }) => ({ id, name }));
  if (usesMultiPool(config, entries.length)) {
    const groups =
      layout.mode === "manual" && layout.poolGroups?.length
        ? layout.poolGroups
        : initPoolGroupsFromSnake(entries, config);
    groups.forEach((g, i) => g.entryIds.forEach((id) => where.set(id, `Pool ${POOL_LETTERS[i]}`)));
  } else if (config.final.type === "single_elimination" || config.final.type === "double_elimination") {
    const seedOf = new Map(entries.map((e, i) => [e.id, i + 1]));
    for (const [x, y] of seededPairs(entries)) {
      if (x) where.set(x.id, y ? `vs #${seedOf.get(y.id)}` : "Bye");
      if (y) where.set(y.id, x ? `vs #${seedOf.get(x.id)}` : "Bye");
    }
  }
  return where;
}

export function SeedingWorkspace({
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
  const [layout, setLayout] = useState<SeedingLayout>(() =>
    mergeLayoutWithEntries(
      config,
      entries.filter((e) => !e.withdrawn).map(({ id, name }) => ({ id, name })),
      config.seedingLayout ?? null
    )
  );
  const showPoolsTab = usesMultiPool(config, order.length);
  const showBracketTab = usesKnockoutSlotSeeding(config, order.length);
  const [tab, setTab] = useState<Tab>(() => (showPoolsTab ? "pools" : showBracketTab ? "bracket" : "list"));
  const [dragging, setDragging] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const seedTimer = useRef<number | undefined>(undefined);
  const layoutTimer = useRef<number | undefined>(undefined);
  const withdrawn = entries.filter((e) => e.withdrawn);
  const activeEntries = order.map(({ id, name }) => ({ id, name }));
  const showPools = showPoolsTab;
  const showBracket = showBracketTab;
  const where = useMemo(() => landing(order, config, layout), [order, config, layout]);
  const readOnlyPools = layout.mode !== "manual";
  const readOnlyBracket = layout.mode !== "manual";

  const serverKey = entries.map((e) => `${e.id}:${e.withdrawn}`).join(",");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    const nextOrder = entries.filter((e) => !e.withdrawn);
    setOrder(nextOrder);
    setLayout(
      mergeLayoutWithEntries(
        config,
        nextOrder.map(({ id, name }) => ({ id, name })),
        config.seedingLayout ?? layout
      )
    );
  }

  useEffect(
    () => () => {
      window.clearTimeout(seedTimer.current);
      window.clearTimeout(layoutTimer.current);
    },
    []
  );

  function persistSeeds(next: SeedEntry[]) {
    window.clearTimeout(seedTimer.current);
    setSaveState("saving");
    seedTimer.current = window.setTimeout(async () => {
      const res = await saveSeedsAction(divisionId, [...next, ...withdrawn].map((e) => e.id));
      if (res.error) {
        toast.error(res.error);
        setSaveState("idle");
      } else setSaveState("saved");
    }, 600);
  }

  function persistLayout(next: SeedingLayout, list: SeedEntry[]) {
    window.clearTimeout(layoutTimer.current);
    setSaveState("saving");
    layoutTimer.current = window.setTimeout(async () => {
      const res = await saveSeedingLayoutAction(
        divisionId,
        next,
        list.map((e) => e.id)
      );
      if (res.error) {
        toast.error(res.error);
        setSaveState("idle");
      } else setSaveState("saved");
    }, 600);
  }

  function reorder(next: SeedEntry[], animate = false) {
    if (animate) startTransition(() => setOrder(next));
    else setOrder(next);
    persistSeeds(next);
    if (layout.mode === "standard" && showPools) {
      const groups = initPoolGroupsFromSnake(
        next.map(({ id, name }) => ({ id, name })),
        config
      );
      setLayout((l) => ({ ...l, poolGroups: groups }));
    }
    if (layout.mode === "standard" && showBracket) {
      setLayout((l) => ({
        ...l,
        knockoutSlots: initKnockoutSlotsFromOrder(next.map(({ id, name }) => ({ id, name }))),
      }));
    }
  }

  function setSeedNumber(index: number, raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > order.length) return;
    const target = n - 1;
    if (target === index) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    reorder(next, true);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next, true);
  }

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
    persistSeeds(order);
  }

  async function toggleWithdraw(id: string, withdraw: boolean) {
    const res = await withdrawEntryAction(id, withdraw);
    if (res.error) return toast.error(res.error);
    toast.success(withdraw ? "Entry withdrawn" : "Entry reinstated");
    router.refresh();
  }

  function setMode(mode: "standard" | "manual") {
    if (mode === layout.mode) return;
    if (mode === "standard" && layout.mode === "manual") {
      if (
        !window.confirm(
          "Switch to standard seeding? Pool and bracket tabs will follow the seed list (snake / bracket order)."
        )
      ) {
        return;
      }
      const groups = initPoolGroupsFromSnake(activeEntries, config);
      const slots = initKnockoutSlotsFromOrder(activeEntries);
      const next: SeedingLayout = { mode: "standard", poolGroups: groups, knockoutSlots: slots };
      setLayout(next);
      persistLayout(next, order);
      return;
    }
    const next: SeedingLayout = {
      mode: "manual",
      poolGroups: layout.poolGroups ?? initPoolGroupsFromSnake(activeEntries, config),
      knockoutSlots: layout.knockoutSlots ?? initKnockoutSlotsFromOrder(activeEntries),
    };
    setLayout(next);
    persistLayout(next, order);
  }

  function onPoolGroupsChange(groups: PoolGroup[]) {
    const next = { ...layout, mode: "manual" as const, poolGroups: groups };
    setLayout(next);
    persistLayout(next, order);
  }

  function onKnockoutSlotsChange(slots: (string | null)[]) {
    const next = { ...layout, mode: "manual" as const, knockoutSlots: slots };
    setLayout(next);
    persistLayout(next, order);
  }

  const poolGroups = layout.poolGroups ?? initPoolGroupsFromSnake(activeEntries, config);
  const poolColumns = (groups: PoolGroup[]): PoolColumnDef[] =>
    groups.map((g, i) => ({ letter: POOL_LETTERS[i], entryIds: g.entryIds }));
  const knockoutSlots =
    layout.knockoutSlots ?? initKnockoutSlotsFromOrder(activeEntries);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "list", label: "Seed list", show: true },
    { id: "pools", label: "Pools", show: showPools },
    { id: "bracket", label: "Bracket slots", show: showBracket },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-bone">Seeding</h3>
          <p className="text-sm text-muted-foreground">
            Set seed order, then use Pools or Bracket tabs to place teams manually (Challonge-style).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-16 items-center gap-1 font-mono text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
            {saveState === "saved" && <Check className="size-3 text-brass" />}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
          </span>
          <div className="flex rounded-lg border border-line p-0.5">
            {(["standard", "manual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize",
                  layout.mode === m ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm transition-colors",
                tab === t.id ? "border-brass text-bone" : "border-transparent text-muted-foreground hover:text-bone"
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => reorder([...order].sort((x, y) => x.createdAt.localeCompare(y.createdAt)), true)}
            >
              <ListRestart />
              Registration order
            </Button>
            <Button size="sm" variant="outline" onClick={() => reorder(shuffle(order), true)}>
              <Shuffle />
              Shuffle
            </Button>
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
                    <label className="sr-only" htmlFor={`seed-${entry.id}`}>
                      Seed for {entry.name}
                    </label>
                    <input
                      id={`seed-${entry.id}`}
                      type="number"
                      min={1}
                      max={order.length}
                      value={i + 1}
                      onChange={(e) => setSeedNumber(i, e.target.value)}
                      className="display w-10 rounded-md border border-line bg-ink/60 text-center text-lg text-brass tabular-nums"
                    />
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
        </>
      )}

      {tab === "pools" && showPools && (
        <>
          {readOnlyPools && (
            <p className="text-sm text-muted-foreground">
              Preview from seed list (standard). Switch to <strong className="text-bone">manual</strong> to drag teams
              between pools.
            </p>
          )}
          <PoolSeedingBoard
            entries={activeEntries}
            config={config}
            columns={
              readOnlyPools
                ? poolColumns(initPoolGroupsFromSnake(activeEntries, config))
                : poolColumns(poolGroups)
            }
            onChange={(columns) => onPoolGroupsChange(columns.map((c) => ({ entryIds: c.entryIds })))}
            readOnly={readOnlyPools}
          />
        </>
      )}

      {tab === "bracket" && showBracket && (
        <>
          {readOnlyBracket && (
            <p className="text-sm text-muted-foreground">
              Preview from seed list (standard). Switch to <strong className="text-bone">manual</strong> to place teams
              on seed lines.
            </p>
          )}
          <KnockoutSeedingBracket
            entries={activeEntries}
            slots={readOnlyBracket ? initKnockoutSlotsFromOrder(activeEntries) : knockoutSlots}
            onChange={onKnockoutSlotsChange}
            readOnly={readOnlyBracket}
          />
        </>
      )}

      {withdrawn.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Withdrawn</p>
          <ul className="space-y-1">
            {withdrawn.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-sm"
              >
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
