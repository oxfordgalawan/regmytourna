"use client";

import { startTransition, useState } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { BracketView } from "@/components/draw/bracket-view";
import type { DrawView } from "@/lib/draw/view";

/** Read-only live draws on the public tournament page, one category at a time. */
export function PublicDraw({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Array<{ id: string; name: string; view: DrawView }>;
}) {
  const [active, setActive] = useState(categories[0]?.id);
  const current = categories.find((c) => c.id === active) ?? categories[0];
  if (!current) return null;

  return (
    <div className="space-y-6">
      {categories.length > 1 && (
        <FilterChips
          label="Category"
          chips={categories.map((c) => ({
            key: c.id,
            label: c.name,
            active: c.id === current.id,
            // a transition lets the draw crossfade between categories
            onSelect: () => startTransition(() => setActive(c.id)),
          }))}
        />
      )}
      <BracketView key={current.id} mode="public" tournamentId={tournamentId} {...current.view} />
    </div>
  );
}
