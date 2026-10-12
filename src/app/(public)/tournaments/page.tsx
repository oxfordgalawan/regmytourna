import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin, Search, SearchX, X } from "lucide-react";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import { isSupabaseConfigured } from "@/lib/env/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tournaments" };

type Params = {
  q?: string;
  sport?: string;
  city?: string;
  status?: string;
  page?: string;
};

const statusFilters = [
  { value: "", label: "All" },
  { value: "registration_open", label: "Open for entries" },
  { value: "published", label: "Announced" },
  { value: "in_progress", label: "Live now" },
  { value: "completed", label: "Completed" },
];

function hrefWith(params: Params, patch: Partial<Params>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (v) next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/tournaments?${qs}` : "/tournaments";
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const hasFilters = Boolean(params.q || params.city || params.sport || params.status);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Alert>
          <AlertDescription>
            Supabase is not configured. Add environment variables from `.env.example` to browse
            tournaments.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { data, count } = await listPublicTournaments({
    search: params.q,
    sport: params.sport,
    city: params.city,
    status: params.status,
    page,
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Find your next event</p>
          <h1 className="display mt-3 text-6xl text-bone sm:text-7xl">Tournaments</h1>
        </div>
        <p className="font-mono text-sm text-muted-foreground" aria-live="polite">
          {total} {total === 1 ? "event" : "events"}
          {hasFilters ? " match your filters" : " listed"}
        </p>
      </header>

      <div className="sticky top-16 z-30 -mx-4 mt-10 border-y border-line bg-ink/90 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]" role="search">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <label className="relative">
            <span className="sr-only">Search tournaments</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name or venue"
              className="h-11 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass md:text-sm"
            />
          </label>
          <label className="relative">
            <span className="sr-only">City</span>
            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="city"
              defaultValue={params.city}
              placeholder="Any city"
              className="h-11 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass md:text-sm"
            />
          </label>
          <Button type="submit" className="h-11">
            Search
          </Button>
        </form>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {statusFilters.map((f) => {
            const active = (params.status ?? "") === f.value;
            return (
              <Link
                key={f.value || "all"}
                href={hrefWith(params, { status: f.value, page: undefined })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "border-bone bg-bone text-ink"
                    : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone"
                )}
              >
                {f.label}
              </Link>
            );
          })}
          {hasFilters && (
            <Link
              href="/tournaments"
              className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-bone"
            >
              <X className="size-3.5" />
              Clear
            </Link>
          )}
        </div>
      </div>

      {data.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-10"
          icon={SearchX}
          title={hasFilters ? "No tournaments match those filters" : "No tournaments yet"}
          description={
            hasFilters
              ? "Try a different city, or clear the filters to see every event."
              : "Nothing is published right now. Check back soon."
          }
          action={
            hasFilters ? (
              <Button variant="outline" asChild>
                <Link href="/tournaments">Clear filters</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {totalPages > 1 && (
        <nav
          className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-6"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={hrefWith(params, { page: String(page - 1) })}>
                <ArrowLeft />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" asChild>
              <Link href={hrefWith(params, { page: String(page + 1) })}>
                Next
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
