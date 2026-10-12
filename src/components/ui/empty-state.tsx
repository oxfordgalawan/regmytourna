import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "court-grid relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-bone/15 px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-umber bg-espresso text-bone">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
