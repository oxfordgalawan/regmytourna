import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

/** Mark: a court seen from above — baseline, kitchen line, centre line. */
function CourtMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--umber)" />
      <rect x="7" y="6" width="18" height="20" rx="1.5" stroke="var(--bone)" strokeWidth="1.8" />
      <path d="M7 16h18" stroke="var(--bone)" strokeWidth="1.8" />
      <path d="M7 12.5h18M7 19.5h18" stroke="var(--bone)" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M16 6v6.5M16 19.5V26" stroke="var(--bone)" strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="RegMyTourna home"
    >
      <CourtMark className="size-8 transition-transform duration-300 group-hover:-rotate-6" />
      {showWordmark && (
        <span className="display text-[1.35rem] leading-none text-bone">
          RegMy<span className="text-brass">Tourna</span>
        </span>
      )}
    </Link>
  );
}
