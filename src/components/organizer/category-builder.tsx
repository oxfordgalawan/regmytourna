"use client";

import { startTransition, useId, useMemo, useState, ViewTransition } from "react";
import { Copy, Plus, Settings2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterChips } from "@/components/ui/filter-chips";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSection } from "@/components/organizer/form-section";
import { FormatPicker } from "@/components/organizer/format-picker";
import { defaultConfigFor, describeFormat, type BracketConfig } from "@/lib/bracket-format";
import {
  CATEGORY_TYPES,
  categoryName,
  categoryType,
  entrantNoun,
  type CategoryType,
} from "@/lib/categories";
import { formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";

type Draft = {
  id: string;
  title: string;
  type: CategoryType;
  capacity: number;
  fee: string; // pesos, only used in per-category mode
  /** only used in per-category format mode; unset = best fit for its size */
  format?: BracketConfig;
};

type Mode = "shared" | "per";

const DEFAULT_CAPACITY = 16;

let nextId = 0;
const newDraft = (patch: Partial<Omit<Draft, "id">> = {}): Draft => ({
  title: "",
  type: "mens_doubles",
  capacity: DEFAULT_CAPACITY,
  fee: "",
  ...patch,
  id: `cat-${++nextId}`,
});

const toCents = (pesos: string) => Math.max(0, Math.round(Number(pesos || 0) * 100));

function PesoInput({
  id,
  value,
  onChange,
  placeholder = "0",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
        ₱
      </span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 font-mono"
      />
    </div>
  );
}

/**
 * Card-based editor for a tournament's categories. Emits two hidden fields:
 * `categories` (JSON) and `entryFeeCents` (shared fee, or the lowest category fee).
 */
export function CategoryBuilder() {
  const uid = useId();
  const [feeMode, setFeeMode] = useState<Mode>("shared");
  const [formatMode, setFormatMode] = useState<Mode>("shared");
  /** null until the organizer picks something: follows the largest category */
  const [sharedFormat, setSharedFormat] = useState<BracketConfig | null>(null);
  const [editing, setEditing] = useState<{ id: string; config: BracketConfig } | null>(null);
  const [sharedFee, setSharedFee] = useState("");
  // fixed id for the first card so server and client markup match
  const [drafts, setDrafts] = useState<Draft[]>(() => [{ ...newDraft(), id: "cat-0" }]);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // list changes run as transitions so <ViewTransition> animates cards in/out
  const add = () =>
    startTransition(() => {
      setDrafts((list) => {
        const last = list.at(-1);
        return [...list, newDraft({ capacity: last?.capacity ?? DEFAULT_CAPACITY, fee: last?.fee ?? "" })];
      });
    });
  const duplicate = (d: Draft) =>
    startTransition(() => {
      setDrafts((list) => {
        const i = list.findIndex((x) => x.id === d.id);
        // a copy is almost always the same level in another play type
        const usedTypes = new Set(list.filter((x) => x.title === d.title).map((x) => x.type));
        const nextType = CATEGORY_TYPES.find((t) => !usedTypes.has(t.value))?.value ?? d.type;
        const { title, capacity, fee, format } = d;
        const copy = newDraft({ title, capacity, fee, format, type: nextType });
        return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
      });
    });
  const remove = (id: string) =>
    startTransition(() => setDrafts((list) => list.filter((d) => d.id !== id)));

  const switchFeeMode = (mode: Mode) => {
    if (mode === "per") {
      // carry the shared fee into any card that doesn't have one yet
      setDrafts((list) => list.map((d) => (d.fee ? d : { ...d, fee: sharedFee })));
    }
    setFeeMode(mode);
  };

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of drafts) {
      const key = categoryName(d.type, d.title).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
  }, [drafts]);

  const feeFor = (d: Draft) => (feeMode === "shared" ? toCents(sharedFee) : toCents(d.fee));

  const largest = Math.max(...drafts.map((d) => d.capacity));
  const effectiveShared = sharedFormat ?? defaultConfigFor(largest);
  const formatFor = (d: Draft) =>
    formatMode === "shared" ? effectiveShared : (d.format ?? defaultConfigFor(d.capacity));

  const switchFormatMode = (mode: Mode) => {
    if (mode === "per" && sharedFormat) {
      // start every card from the format already chosen for all
      setDrafts((list) => list.map((d) => (d.format ? d : { ...d, format: sharedFormat })));
    }
    setFormatMode(mode);
  };
  const openEditor = (d: Draft) => {
    const config = formatFor(d);
    if (formatMode === "shared") switchFormatMode("per");
    setEditing({ id: d.id, config });
  };
  const editingDraft = editing ? drafts.find((d) => d.id === editing.id) : undefined;

  const payload = drafts.map((d) => ({
    title: d.title,
    type: d.type,
    capacity: d.capacity,
    entryFeeCents: feeFor(d),
    bracketConfig: formatFor(d),
  }));
  const tournamentFee =
    feeMode === "shared" ? toCents(sharedFee) : Math.min(...drafts.map((d) => toCents(d.fee)));
  const totalSlots = drafts.reduce((n, d) => n + d.capacity, 0);

  return (
    <>
      <FormSection
        step={4}
        wide
        title="Categories"
        description="Each category is its own bracket. Add as many as you run — e.g. Men's Doubles · Novice."
      >
    <div className="space-y-6 sm:col-span-2">
      <input type="hidden" name="categories" value={JSON.stringify(payload)} />
      <input type="hidden" name="entryFeeCents" value={Number.isFinite(tournamentFee) ? tournamentFee : 0} />

      {/* Fee mode */}
      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-bone">Registration fee</p>
            <p className="text-sm text-muted-foreground">Charged per team (or per player in singles).</p>
          </div>
          <FilterChips
            label="Fee mode"
            chips={[
              { key: "shared", label: "Same for all", active: feeMode === "shared", onSelect: () => switchFeeMode("shared") },
              { key: "per", label: "Per category", active: feeMode === "per", onSelect: () => switchFeeMode("per") },
            ]}
          />
        </div>
        {feeMode === "shared" && (
          <div className="mt-4 max-w-xs animate-in fade-in-0 slide-in-from-top-1">
            <Label htmlFor={`${uid}-shared`} className="sr-only">
              Fee for every category
            </Label>
            <PesoInput id={`${uid}-shared`} value={sharedFee} onChange={setSharedFee} />
          </div>
        )}
        <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 border-t border-line pt-4">
          <span>
            <span className="block text-sm font-medium text-bone">Allow walk-in payment</span>
            <span className="block text-sm text-muted-foreground">
              Players can reserve online and pay at the venue — you mark them paid in cash or show a QR.
            </span>
          </span>
          <span className="relative mt-0.5 inline-flex shrink-0">
            <input type="checkbox" name="allowWalkInPayment" className="peer sr-only" />
            <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone peer-focus-visible:ring-2 peer-focus-visible:ring-brass" />
            <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
          </span>
        </label>
      </div>

      {/* Category cards */}
      <ol className="grid gap-4 lg:grid-cols-2">
        {drafts.map((d, i) => {
          const type = categoryType(d.type);
          const dup = duplicates.has(categoryName(d.type, d.title).toLowerCase());
          return (
            <ViewTransition key={d.id} enter="vt-fade" exit="vt-fade" update="vt-fade" default="none">
              <li
                className={cn(
                  "group/card flex flex-col rounded-2xl border bg-surface transition-colors",
                  dup ? "border-rust/60" : "border-line hover:border-umber"
                )}
              >
                <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                  <span className="font-mono text-xs text-brass">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded-md bg-umber px-1.5 py-0.5 font-mono text-[0.65rem] text-bone">
                    {type.short}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {categoryName(d.type, d.title)}
                  </span>
                  <button
                    type="button"
                    onClick={() => duplicate(d)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-espresso hover:text-bone"
                    aria-label={`Duplicate category ${i + 1}`}
                    title="Duplicate"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={drafts.length === 1}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rust/15 hover:text-[#e58a72] disabled:pointer-events-none disabled:opacity-30"
                    aria-label={`Remove category ${i + 1}`}
                    title="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="grid flex-1 gap-4 p-5">
                  <div className="space-y-2">
                    <Label htmlFor={`${uid}-${d.id}-title`}>Category title</Label>
                    <Input
                      id={`${uid}-${d.id}-title`}
                      value={d.title}
                      maxLength={60}
                      autoFocus={i > 0 && d.title === ""}
                      placeholder="e.g. Low Intermediate, Novice, Open"
                      aria-invalid={dup}
                      onChange={(e) => update(d.id, { title: e.target.value })}
                    />
                    {dup && (
                      <p className="text-xs text-[#e58a72]">
                        Another card already uses this type and title.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium">Type</span>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category type">
                      {CATEGORY_TYPES.map((t) => {
                        const active = d.type === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => update(d.id, { type: t.value })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs transition-all duration-200",
                              active
                                ? "border-bone bg-bone text-ink"
                                : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone"
                            )}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={cn("grid gap-4", feeMode === "per" && "sm:grid-cols-2")}>
                    <div className="space-y-2">
                      <Label htmlFor={`${uid}-${d.id}-cap`}>
                        How many {entrantNoun(type.format)}?
                      </Label>
                      <Stepper
                        id={`${uid}-${d.id}-cap`}
                        min={2}
                        max={512}
                        value={d.capacity}
                        onChange={(capacity) => update(d.id, { capacity })}
                      />
                    </div>
                    {feeMode === "per" && (
                      <div className="space-y-2 animate-in fade-in-0">
                        <Label htmlFor={`${uid}-${d.id}-fee`}>
                          Fee per {entrantNoun(type.format, 1)}
                        </Label>
                        <PesoInput
                          id={`${uid}-${d.id}-fee`}
                          value={d.fee}
                          onChange={(fee) => update(d.id, { fee })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <FormatChip info={describeFormat(formatFor(d), d.capacity)} onClick={() => openEditor(d)} />
                <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-ink/30 px-5 py-3 font-mono text-xs text-muted-foreground">
                  <span>
                    {d.capacity} {entrantNoun(type.format, d.capacity)}
                  </span>
                  <span className="text-bone">{formatPhp(feeFor(d))}</span>
                </div>
              </li>
            </ViewTransition>
          );
        })}

        <ViewTransition default="vt-fade">
          <li className={cn(drafts.length % 2 === 0 && "lg:col-span-2")}>
            <button
              type="button"
              onClick={add}
              className="group flex h-full min-h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-umber bg-umber/5 p-6 text-sm text-bone/80 transition-all hover:border-brass hover:bg-umber/20 hover:text-bone"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-umber transition-transform duration-300 group-hover:rotate-90">
                <Plus className="size-5" />
              </span>
              Add category
            </button>
          </li>
        </ViewTransition>
      </ol>

      <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
        {drafts.length} {drafts.length === 1 ? "category" : "categories"} · {totalSlots} slots in total
      </p>
    </div>
      </FormSection>

      <FormSection
        step={5}
        wide
        title="Format"
        description="How each category is played. We suggest a best fit for its size — you can change it any time before play starts."
      >
        <div className="space-y-6 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
            <div>
              <p className="text-sm font-medium text-bone">Bracket format</p>
              <p className="text-sm text-muted-foreground">
                {formatMode === "shared"
                  ? `One format for every category. Numbers are shown for your largest category (${largest}).`
                  : "Each category keeps its own format. Tap a category to change it."}
              </p>
            </div>
            <FilterChips
              label="Format mode"
              chips={[
                { key: "shared", label: "Same for all", active: formatMode === "shared", onSelect: () => switchFormatMode("shared") },
                { key: "per", label: "Per category", active: formatMode === "per", onSelect: () => switchFormatMode("per") },
              ]}
            />
          </div>

          {formatMode === "shared" ? (
            <FormatPicker value={effectiveShared} onChange={setSharedFormat} teams={largest} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {drafts.map((d) => (
                <li key={d.id} className="bg-surface">
                  <p className="px-5 pt-4 font-medium text-bone">{categoryName(d.type, d.title)}</p>
                  <FormatChip info={describeFormat(formatFor(d), d.capacity)} onClick={() => openEditor(d)} bare />
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormSection>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          {editing && editingDraft && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {categoryName(editingDraft.type, editingDraft.title)}
                </DialogTitle>
                <DialogDescription>
                  {editingDraft.capacity}{" "}
                  {entrantNoun(categoryType(editingDraft.type).format, editingDraft.capacity)} · pick
                  how this category is played.
                </DialogDescription>
              </DialogHeader>
              <FormatPicker
                value={editing.config}
                onChange={(config) => setEditing({ id: editing.id, config })}
                teams={editingDraft.capacity}
                noun={entrantNoun(categoryType(editingDraft.type).format)}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    update(editing.id, { format: editing.config });
                    setEditing(null);
                  }}
                >
                  Use this format
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormatChip({
  info,
  onClick,
  bare = false,
}: {
  info: { name: string; matches: string; guaranteed: string };
  onClick: () => void;
  bare?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/format flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-espresso/60",
        !bare && "border-t border-line"
      )}
    >
      <Settings2 className="size-4 shrink-0 text-brass" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-bone">{info.name}</span>
        <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
          {info.matches} · {info.guaranteed}
        </span>
      </span>
      <span className="text-xs text-muted-foreground transition-colors group-hover/format:text-bone">
        Customize
      </span>
    </button>
  );
}
