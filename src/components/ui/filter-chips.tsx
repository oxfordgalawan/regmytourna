"use client";

import Link from "next/link";
import { useSlidingIndicator } from "@/components/motion/use-sliding-indicator";
import { cn } from "@/lib/utils";

type Chip = { key: string; label: string; active: boolean } & (
  | { href: string; onSelect?: never }
  | { onSelect: () => void; href?: never }
);

/** Pill filter row; the selected pill glides between options. Links keep scroll position. */
export function FilterChips({
  chips,
  label,
  className,
}: {
  chips: Chip[];
  label: string;
  className?: string;
}) {
  const activeKey = chips.find((c) => c.active)?.key;
  const { ref, style, ready } = useSlidingIndicator<HTMLDivElement>(activeKey);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn("relative flex gap-1.5 overflow-x-auto scrollbar-none", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-bone"
        style={style}
      />
      {chips.map((chip) => {
        const cls = cn(
          "relative shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-300",
          chip.active
            ? cn("border-bone text-ink", !ready && "bg-bone")
            : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone"
        );
        return chip.href !== undefined ? (
          <Link
            key={chip.key}
            href={chip.href}
            scroll={false}
            data-active={chip.active}
            aria-current={chip.active ? "true" : undefined}
            className={cls}
          >
            {chip.label}
          </Link>
        ) : (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onSelect}
            data-active={chip.active}
            aria-pressed={chip.active}
            className={cls}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
