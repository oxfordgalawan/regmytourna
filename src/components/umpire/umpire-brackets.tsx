"use client";

import { startTransition, useState } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { BracketView } from "@/components/draw/bracket-view";
import type { DrawView } from "@/lib/draw/view";

export function UmpireBrackets({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Array<{ id: string; name: string; view: DrawView }>;
}) {
  const [active, setActive] = useState(categories[0]?.id);
  const current = categories.find((c) => c.id === active) ?? categories[0];
  if (!current) {
    return <p className="text-sm text-muted-foreground">Brackets appear once the organizer starts a category.</p>;
  }

  return (
    <div className="space-y-6">
      {categories.length > 1 && (
        <FilterChips
          label="Category"
          chips={categories.map((c) => ({
            key: c.id,
            label: c.name,
            active: c.id === current.id,
            onSelect: () => startTransition(() => setActive(c.id)),
          }))}
        />
      )}
      <BracketView key={current.id} mode="public" tournamentId={tournamentId} {...current.view} />
    </div>
  );
}
