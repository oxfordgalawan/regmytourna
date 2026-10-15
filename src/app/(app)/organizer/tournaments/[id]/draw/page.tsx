import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFormat, parseBracketConfig } from "@/lib/bracket-format";
import { entrantNoun } from "@/lib/categories";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";

const STATE: Record<string, { label: string; tone: string }> = {
  not_started: { label: "Seeding", tone: "border-line text-muted-foreground" },
  pools: { label: "Pools in play", tone: "border-rust/40 bg-rust/10 text-[#e58a72]" },
  pools_done: { label: "Pools finished", tone: "border-brass/40 bg-brass/10 text-brass" },
  final: { label: "In play", tone: "border-rust/40 bg-rust/10 text-[#e58a72]" },
  complete: { label: "Complete", tone: "border-bone bg-bone text-ink" },
};

export default async function DrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: divisions }, { data: regs }, { data: matches }] = await Promise.all([
    supabase
      .from("tournament_divisions")
      .select("id, name, format, capacity, bracket_config, bracket_state")
      .eq("tournament_id", id)
      .order("sort_order"),
    supabase.from("registrations").select("division_id, withdrawn_at").eq("tournament_id", id).eq("status", "confirmed"),
    supabase.from("matches").select("division_id, status, is_bye").eq("tournament_id", id).not("stage", "is", null),
  ]);

  if (!divisions?.length) {
    return (
      <EmptyState
        icon={Layers}
        title="No categories yet"
        description="Add categories first — each one gets its own draw."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-3xl text-bone">Brackets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a category to seed, start, or manage the draw.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
      {divisions.map((d) => {
        const entries = (regs ?? []).filter((r) => r.division_id === d.id && !r.withdrawn_at).length;
        const own = (matches ?? []).filter((m) => m.division_id === d.id && !m.is_bye && m.status !== "cancelled");
        const played = own.filter((m) => m.status === "completed" || m.status === "walkover").length;
        const state = STATE[d.bracket_state ?? "not_started"] ?? STATE.not_started;
        const format = describeFormat(parseBracketConfig(d.bracket_config, d.capacity ?? 16), Math.max(entries, 2));
        return (
          <li key={d.id}>
            <Link
              href={`/organizer/tournaments/${id}/draw/${d.id}`}
              transitionTypes={NAV_FORWARD}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-umber"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-bone">{d.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{format.name}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs", state.tone)}>{state.label}</span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {entries} {entrantNoun(d.format, entries)}
                  {own.length > 0 && ` · ${played}/${own.length} matches played`}
                </span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              {own.length > 0 && (
                <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-bone transition-all duration-700" style={{ width: `${(played / own.length) * 100}%` }} />
                </div>
              )}
            </Link>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
