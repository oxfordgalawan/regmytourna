import { Suspense } from "react";
import Form from "next/form";
import { Search, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import { PageHeader } from "@/components/layout/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCards } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/tournament-card";

export const metadata = { title: "Explore" };

type Params = { q?: string; status?: string };

const FILTERS = [
  { value: "registration_open", label: "Open for entries" },
  { value: "in_progress", label: "Live now" },
  { value: "published", label: "Coming soon" },
  { value: "", label: "All" },
];

function href(params: Params, patch: Partial<Params>) {
  const qs = new URLSearchParams();
  const merged = { ...params, ...patch };
  if (merged.q) qs.set("q", merged.q);
  // "open for entries" is the default view, so it needs no param
  if (merged.status !== undefined && merged.status !== "registration_open") qs.set("status", merged.status || "all");
  const s = qs.toString();
  return s ? `/explore?${s}` : "/explore";
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser("/explore");
  const params = await searchParams;
  const status = params.status === "all" ? "" : (params.status ?? "registration_open");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find your next event" title="Explore" />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 space-y-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4 lg:top-4">
        <Form action="/explore" scroll={false} role="search" className="relative">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <label className="sr-only" htmlFor="explore-q">
            Search tournaments
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="explore-q"
            name="q"
            defaultValue={params.q}
            placeholder="City, venue or tournament name"
            className="h-12 w-full rounded-full border border-input bg-ink/40 pr-4 pl-11 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass"
          />
        </Form>
        <FilterChips
          label="Show"
          chips={FILTERS.map((f) => ({
            key: f.value || "all",
            label: f.label,
            active: status === f.value,
            href: href(params, { status: f.value }),
          }))}
        />
      </div>

      <Suspense key={`${params.q ?? ""}|${status}`} fallback={<SkeletonCards />}>
        <Results q={params.q} status={status} />
      </Suspense>
    </div>
  );
}

async function Results({ q, status }: { q?: string; status: string }) {
  const { data } = await listPublicTournaments({ search: q, status: status || undefined, pageSize: 24 });
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
