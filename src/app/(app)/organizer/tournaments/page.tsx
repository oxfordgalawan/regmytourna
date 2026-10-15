import { Suspense } from "react";
import Link from "next/link";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import Form from "next/form";
import { FilterChips } from "@/components/ui/filter-chips";
import { ChevronRight, Plus, Search, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonList } from "@/components/ui/skeleton";
import { dateTile, formatDateRange } from "@/lib/format";

export const metadata = { title: "My events" };

const statusFilters = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "registration_open", label: "Open" },
  { value: "in_progress", label: "Live" },
  { value: "completed", label: "Completed" },
];

export default async function OrganizerTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { q, status } = await searchParams;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organizer"
        title="My events"
        description="Everything you’re running, from first draft to final results."
        actions={
          <Button asChild>
            <Link href="/organizer/tournaments/new">
              <Plus />
              New tournament
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Form action="/organizer/tournaments" scroll={false} className="relative w-full sm:w-72" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="org-search" className="sr-only">
            Search your events
          </label>
          <input
            id="org-search"
            name="q"
            defaultValue={q}
            placeholder="Search your events"
            className="h-10 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-sm text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass"
          />
        </Form>
        <FilterChips
          label="Filter by status"
          chips={statusFilters.map((f) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (f.value) params.set("status", f.value);
            const qs = params.toString();
            return {
              key: f.label,
              label: f.label,
              active: (status ?? "") === f.value,
              href: `/organizer/tournaments${qs ? `?${qs}` : ""}`,
            };
          })}
        />
      </div>

      <Suspense key={`${q ?? ""}|${status ?? ""}`} fallback={<SkeletonList rows={5} />}>
        <EventList userId={user.id} q={q} status={status} />
      </Suspense>
    </div>
  );
}


async function EventList({ userId, q, status }: { userId: string; q?: string; status?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("tournaments")
    .select("id, name, slug, status, start_date, end_date, city")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data: tournaments } = await query;
  const filtered = Boolean(q || status);

  return (
    <div className="animate-in fade-in-0 duration-500">
    {!tournaments?.length ? (
      <EmptyState
        icon={Trophy}
        title={filtered ? "No events match" : "Your first event starts here"}
        description={
          filtered
            ? "Try another search or status."
            : "Create a tournament, add divisions, and open registration — standard pickleball divisions are added for you."
        }
        action={
          filtered ? (
            <Button variant="outline" asChild>
              <Link href="/organizer/tournaments">Clear filters</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/organizer/tournaments/new">
                <Plus />
                Create tournament
              </Link>
            </Button>
          )
        }
      />
    ) : (
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {tournaments.map((t) => {
          const tile = dateTile(t.start_date);
          return (
            <li key={t.id} className="flex items-center gap-2 bg-surface pr-3 sm:pr-5">
              <Link
                href={`/organizer/tournaments/${t.id}`}
                transitionTypes={NAV_FORWARD}
                className="group flex min-w-0 flex-1 items-center gap-4 px-5 py-4 transition-colors hover:bg-espresso/60"
              >
                <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-umber py-1 text-center">
                  <span className="font-mono text-[0.6rem] tracking-widest text-brass">
                    {tile?.month ?? "TBA"}
                  </span>
                  <span className="display text-2xl text-bone">{tile?.day ?? "––"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-bone">{t.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[t.city, formatDateRange(t.start_date, t.end_date)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge status={t.status} />
                <span className="hidden items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-bone sm:inline-flex">
                  Manage
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link href={`/organizer/tournaments/${t.id}/draw`} transitionTypes={NAV_FORWARD}>
                  Brackets
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    )}
    </div>
  );
}
