import { cn } from "@/lib/utils";

type Tone = "live" | "good" | "warn" | "bad" | "neutral" | "quiet";

const statusMeta: Record<string, { label: string; tone: Tone }> = {
  registration_open: { label: "Open for entries", tone: "live" },
  published: { label: "Announced", tone: "neutral" },
  registration_closed: { label: "Entries closed", tone: "quiet" },
  in_progress: { label: "Live now", tone: "live" },
  completed: { label: "Completed", tone: "quiet" },
  cancelled: { label: "Cancelled", tone: "bad" },
  draft: { label: "Draft", tone: "quiet" },
  confirmed: { label: "Confirmed", tone: "good" },
  pending: { label: "Pending", tone: "warn" },
  pending_payment: { label: "Awaiting payment", tone: "warn" },
  waitlisted: { label: "Waitlisted", tone: "warn" },
  paid: { label: "Paid", tone: "good" },
  unpaid: { label: "Unpaid", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
  refunded: { label: "Refunded", tone: "quiet" },
  scheduled: { label: "Scheduled", tone: "neutral" },
};

const toneStyles: Record<Tone, string> = {
  live: "border-bone/30 bg-bone text-ink",
  good: "border-umber bg-umber/50 text-bone",
  warn: "border-brass/40 bg-brass/10 text-brass",
  bad: "border-rust/40 bg-rust/10 text-[#e58a72]",
  neutral: "border-bone/20 bg-espresso text-bone/85",
  quiet: "border-line bg-transparent text-muted-foreground",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const meta = statusMeta[status];
  const tone = meta?.tone ?? "neutral";
  const text = label ?? meta?.label ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap first-letter:uppercase",
        toneStyles[tone],
        className
      )}
    >
      {tone === "live" && (
        <span className="size-1.5 animate-pulse-dot rounded-full bg-current" aria-hidden />
      )}
      {text}
    </span>
  );
}
