import { cn } from "@/lib/utils";

/** Placeholder block with a soft bone-tinted shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--surface)_25%,var(--surface-2)_50%,var(--surface)_75%)]",
        className
      )}
    />
  );
}

/** Wraps a skeleton layout so screen readers announce loading once. */
export function LoadingRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={cn("animate-in fade-in-0 duration-300", className)}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-14 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-1/2 max-w-sm" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-surface px-5 py-4">
          <Skeleton className="size-12 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex gap-4 p-5">
            <Skeleton className="h-16 w-14 shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          </div>
          <div className="space-y-3 border-t border-line p-5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
