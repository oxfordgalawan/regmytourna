import Link from "next/link";
import { ArrowUpRight, MapPin, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { dateTile, formatDateRange, formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TournamentCardData = {
  id: string;
  slug: string;
  name: string;
  status: string;
  sport: string;
  city: string | null;
  venue_name?: string | null;
  start_date: string | null;
  end_date?: string | null;
  entry_fee_cents: number;
  currency: string;
  is_demo?: boolean;
  tournament_divisions?: unknown[];
};

export function TournamentCard({
  tournament: t,
  className,
}: {
  tournament: TournamentCardData;
  className?: string;
}) {
  const tile = dateTile(t.start_date);
  const divisions = t.tournament_divisions?.length ?? 0;

  return (
    <Link
      href={`/tournaments/${t.slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-umber hover:bg-espresso/70",
        className
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-umber text-center">
          <span className="w-full bg-umber py-0.5 font-mono text-[0.625rem] tracking-widest text-bone">
            {tile?.month ?? "TBA"}
          </span>
          <span className="display py-1.5 text-3xl text-bone">{tile?.day ?? "––"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {t.is_demo && <span className="eyebrow">Demo</span>}
          </div>
          <h3 className="mt-2.5 text-lg leading-snug font-semibold text-bone text-balance">
            {t.name}
          </h3>
        </div>
        <ArrowUpRight
          className="size-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-bone"
          aria-hidden
        />
      </div>

      <dl className="mt-auto grid grid-cols-2 border-t border-line text-sm">
        <div className="col-span-2 flex items-center gap-2 border-b border-line px-5 py-3 text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">Location</dt>
          <dd className="truncate">
            {[t.venue_name, t.city].filter(Boolean).join(", ") || "Venue to be announced"}
          </dd>
        </div>
        <div className="border-r border-line px-5 py-3">
          <dt className="eyebrow">Entry</dt>
          <dd className="mt-1 font-mono text-bone">{formatPhp(t.entry_fee_cents, t.currency)}</dd>
        </div>
        <div className="px-5 py-3">
          <dt className="eyebrow">{divisions ? "Divisions" : "When"}</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-bone">
            {divisions ? (
              <>
                <Users className="size-3.5 text-muted-foreground" aria-hidden />
                {divisions}
              </>
            ) : (
              <span className="truncate">{formatDateRange(t.start_date, t.end_date ?? null)}</span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
