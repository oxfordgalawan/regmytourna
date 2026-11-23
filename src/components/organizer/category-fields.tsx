"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_TYPES,
  categoryName,
  categoryType,
  entrantNoun,
  type CategoryType,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

export type CategoryFieldsState = {
  type: CategoryType;
  title: string;
  capacity: string;
  fee: string;
};

type Props = {
  idPrefix: string;
  showFee?: boolean;
  /** When set, only types with this play format can be selected (e.g. entries already registered). */
  lockedFormat?: "singles" | "doubles";
  value: CategoryFieldsState;
  onChange: (patch: Partial<CategoryFieldsState>) => void;
  preview?: boolean;
};

export function CategoryFields({
  idPrefix,
  showFee = true,
  lockedFormat,
  value,
  onChange,
  preview = true,
}: Props) {
  const format = categoryType(value.type).format;
  const name = categoryName(value.type, value.title);

  return (
  <>
    <div className="space-y-2">
      <span className="text-sm font-medium text-bone">Gender / format</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category gender and format">
        {CATEGORY_TYPES.map((t) => {
          const active = value.type === t.value;
          const formatLocked = Boolean(lockedFormat && t.format !== lockedFormat);
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={formatLocked && !active}
              title={formatLocked && !active ? "Can't switch singles and doubles while players are registered." : undefined}
              onClick={() => !formatLocked && onChange({ type: t.value })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-all duration-200",
                active ? "border-bone bg-bone text-ink" : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone",
                formatLocked && !active && "cursor-not-allowed opacity-40 hover:border-line hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-title`}>Category title</Label>
      <Input
        id={`${idPrefix}-title`}
        value={value.title}
        maxLength={60}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="e.g. Low Intermediate"
      />
    </div>

    <div className={cn("grid gap-4", showFee && "grid-cols-2")}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-capacity`}>How many {entrantNoun(format)}?</Label>
        <Input
          id={`${idPrefix}-capacity`}
          type="number"
          min={2}
          inputMode="numeric"
          value={value.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
          required
          className="font-mono"
        />
      </div>
      {showFee && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-fee`}>Fee (₱)</Label>
          <Input
            id={`${idPrefix}-fee`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={value.fee}
            onChange={(e) => onChange({ fee: e.target.value })}
            placeholder="Event default"
            className="font-mono"
          />
        </div>
      )}
    </div>

    {preview && (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-4 py-3">
        <span className="rounded-md bg-umber px-1.5 py-0.5 font-mono text-[0.65rem] text-bone">
          {categoryType(value.type).short}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-bone">{name}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {value.capacity || 0} {entrantNoun(format, Number(value.capacity) || 2)}
        </span>
      </div>
    )}
  </>
  );
}

export function categoryFieldsReady(capacity: string) {
  return Number(capacity) >= 2;
}