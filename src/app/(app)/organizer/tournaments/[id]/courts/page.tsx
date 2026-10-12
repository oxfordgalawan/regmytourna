import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addCourtAction } from "@/app/actions/courts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function CourtsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, sort_order")
    .eq("tournament_id", id)
    .order("sort_order");

  const nextName = `Court ${(courts?.length ?? 0) + 1}`;

  return (
    <div className="space-y-6">
      <form
        action={addCourtAction.bind(null, id)}
        className="flex flex-col gap-3 rounded-2xl border border-dashed border-umber bg-umber/10 p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-2">
          <label htmlFor="court-name" className="text-sm font-medium">
            Add a court
          </label>
          <Input id="court-name" name="name" defaultValue={nextName} required />
        </div>
        <Button type="submit" className="h-11">
          <Plus />
          Add court
        </Button>
      </form>

      {courts?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/court/${c.id}`}
                className="group court-grid flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-umber"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-end justify-between gap-3">
                  <span className="display text-4xl text-bone">{c.name}</span>
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-bone">
                    Score
                    <ArrowUpRight className="size-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          No courts yet. Each court gets its own scoring link referees can open on a phone.
        </p>
      )}
    </div>
  );
}
