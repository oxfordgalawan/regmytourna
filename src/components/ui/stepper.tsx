"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Numeric − / + control. `compact` fits inline inside a sentence. */
export function Stepper({
  id,
  value,
  onChange,
  min = 0,
  max = 999,
  compact = false,
  label,
  className,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  /** accessible name when there's no visible <label> */
  label?: string;
  className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  const btn = cn(
    "flex items-center justify-center text-muted-foreground transition-colors hover:bg-espresso hover:text-bone disabled:opacity-30",
    compact ? "w-8" : "w-11"
  );
  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-lg border border-input bg-ink/40 align-middle",
        compact ? "h-9" : "h-11 w-full",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={label ? `Decrease ${label}` : "Decrease"}
        className={btn}
      >
        <Minus className="size-3.5" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={cn(
          "min-w-0 [appearance:textfield] border-x border-input bg-transparent text-center font-mono text-bone outline-none focus-visible:bg-espresso [&::-webkit-inner-spin-button]:appearance-none",
          compact ? "w-10 text-sm" : "w-full text-base"
        )}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={label ? `Increase ${label}` : "Increase"}
        className={btn}
      >
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}
