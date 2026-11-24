import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { Search, SearchX, X } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import {
  effectivePublicListStatus,
  hasNonDefaultListFilters,
  PUBLIC_LIST_STATUS_TABS,
  statusForListQuery,
} from "@/lib/tournaments/public-list-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCards } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/tournament-card";

export const metadata = { title: "Explore" };

type Params = { q?: string; status?: string };

function href(params: Params, patch: Partial<Params>) {
  const merged = { ...params, ...patch };
  const tab = effectivePublicListStatus(merged.status);
  const qs = new URLSearchParams();
  if (merged.q) qs.set("q", merged.q);
  if (tab !== "upcoming") qs.set("status", tab);
  const s = qs.toString();
  return s ? `/explore?${s}` : "/explore";
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser("/explore");
  const params = await searchParams;
  const tabStatus = effectivePublicListStatus(params.status);
  const hasFilters = hasNonDefaultListFilters(params);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find your next event" title="Explore" />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 space-y-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4 lg:top-4">
        <Form action="/explore" scroll={false} role="search" className="relative">
          <input type="hidden" name="status" value={tabStatus === "all" ? "all" : tabStatus} />
          <label className="sr-only" htmlFor="explore-q">
            Search tournaments
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="explore-q"
            name="q"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={params.q}
            placeholder="City, venue or tournament name"
            className="h-12 w-full rounded-full border border-input bg-ink/40 pr-4 pl-11 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass"
          />
        </Form>
        <div className="flex items-center gap-2">
          <FilterChips
            label="Show"
            className="flex-1"
            chips={PUBLIC_LIST_STATUS_TABS.map((f) => ({
              key: f.value,
              label: f.label,
              active: tabStatus === f.value,
              href: href(params, { status: f.value }),
            }))}
          />
          {hasFilters && (
            <Link
              href="/explore"
              scroll={false}
              className="inline-flex shrink-0 items-center gap-1 px-2 text-sm text-muted-foreground transition-colors hover:text-bone"
            >
              <X className="size-3.5" />
              Clear
            </Link>
          )}
        </div>
      </div>

      <Suspense key={`${params.q ?? ""}|${tabStatus}`} fallback={<SkeletonCards />}>
        <Results q={params.q} tabStatus={tabStatus} />
      </Suspense>
    </div>
  );
}

async function Results({ q, tabStatus }: { q?: string; tabStatus: string }) {
  const { data } = await listPublicTournaments({
    search: q,
    status: statusForListQuery(tabStatus),
    pageSize: 24,
  });
  if (!data.length) {
    return (
      <EmptyState
        icon={SearchX}
        title={q ? `Nothing matches "${q}"` : "Nothing here right now"}
        description="Try another city or filter — new events are added as organizers publish them."
      />
    );
  }
  return (
    <div className="grid gap-4 animate-in fade-in-0 duration-500 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
    </div>
  );
}