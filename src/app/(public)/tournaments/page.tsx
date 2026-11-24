import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { FilterChips } from "@/components/ui/filter-chips";
import { ArrowLeft, ArrowRight, Search, SearchX, X } from "lucide-react";
import { closeMatchTournaments, listPublicTournaments } from "@/lib/tournaments/queries";
import {
  DEFAULT_PUBLIC_LIST_STATUS,
  effectivePublicListStatus,
  hasNonDefaultListFilters,
  PUBLIC_LIST_STATUS_TABS,
  statusForListQuery,
} from "@/lib/tournaments/public-list-tabs";
import { isSupabaseConfigured } from "@/lib/env/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { CityFilterInput } from "@/components/tournaments/city-filter-input";
import { SkeletonCards } from "@/components/ui/skeleton";

export const metadata = { title: "Tournaments" };

type Params = {
  q?: string;
  sport?: string;
  city?: string;
  status?: string;
  page?: string;
};

function hrefWith(params: Params, patch: Partial<Params>) {
  const merged = { ...params, ...patch };
  const tab = effectivePublicListStatus(merged.status);
  const next = new URLSearchParams();
  if (merged.q) next.set("q", merged.q);
  if (merged.city) next.set("city", merged.city);
  if (merged.sport) next.set("sport", merged.sport);
  if (merged.page && merged.page !== "1") next.set("page", merged.page);
  if (tab !== DEFAULT_PUBLIC_LIST_STATUS) next.set("status", tab);
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
  const tabStatus = effectivePublicListStatus(params.status);
  const hasFilters = hasNonDefaultListFilters(params);

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

  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Find your next event</p>
          <h1 className="display mt-3 text-6xl text-bone sm:text-7xl">Tournaments</h1>
        </div>
      </header>

      <div className="sticky top-16 z-30 -mx-4 mt-10 border-y border-line bg-ink/90 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <Form action="/tournaments" scroll={false} className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]" role="search">
          <input
            type="hidden"
            name="status"
            value={tabStatus === "all" ? "all" : tabStatus}
          />
          <label className="relative">
            <span className="sr-only">Search tournaments</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={params.q}
              placeholder="Search by name or venue"
              className="h-11 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass md:text-sm"
            />
          </label>
          <CityFilterInput key={params.city ?? ""} defaultValue={params.city} />
          <Button type="submit" className="h-11">
            Search
          </Button>
        </Form>

        <div className="mt-3 flex items-center gap-2">
          <FilterChips
            label="Filter by status"
            className="flex-1"
            chips={PUBLIC_LIST_STATUS_TABS.map((f) => ({
              key: f.value,
              label: f.label,
              active: tabStatus === f.value,
              href: hrefWith(params, { status: f.value, page: undefined }),
            }))}
          />
          {hasFilters && (
            <Link
              href="/tournaments"
              scroll={false}
              className="inline-flex shrink-0 items-center gap-1 px-2 text-sm text-muted-foreground transition-colors hover:text-bone animate-in fade-in-0"
            >
              <X className="size-3.5" />
              Clear
            </Link>
          )}
        </div>
      </div>

      <Suspense
        key={`${params.q ?? ""}|${params.city ?? ""}|${tabStatus}|${page}`}
        fallback={<SkeletonCards className="mt-8" />}
      >
        <Results params={params} page={page} tabStatus={tabStatus} hasFilters={hasFilters} />
      </Suspense>
    </div>
  );
}

async function Results({
  params,
  page,
  tabStatus,
  hasFilters,
}: {
  params: Params;
  page: number;
  tabStatus: string;
  hasFilters: boolean;
}) {
  const { data, count } = await listPublicTournaments({
    search: params.q,
    sport: params.sport,
    city: params.city,
    status: statusForListQuery(tabStatus),
    page,
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  const close = !data.length && params.q ? await closeMatchTournaments(params.q) : [];
  if (close.length) {
    return (
      <div className="mt-8 animate-in fade-in-0 duration-500">
        <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
          No exact matches for <span className="text-bone">&ldquo;{params.q}&rdquo;</span> — showing the closest{" "}
          {close.length === 1 ? "event" : `${close.length} events`}.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {close.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      </div>
    );
  }

  const countSuffix =
    tabStatus === DEFAULT_PUBLIC_LIST_STATUS && !hasFilters
      ? " upcoming"
      : hasFilters
        ? " match your filters"
        : " listed";

  return (
    <div className="mt-8 animate-in fade-in-0 duration-500">
      <p className="mb-5 font-mono text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "event" : "events"}
        {countSuffix}
      </p>
      {data.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <EmptyState
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