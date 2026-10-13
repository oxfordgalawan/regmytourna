"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addDivisionAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_TYPES,
  categoryName,
  categoryType,
  entrantNoun,
  type CategoryType,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Adds one category to an existing tournament (same fields as the create form). */
export function AddDivisionForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<CategoryType>("mens_doubles");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const format = categoryType(type).format;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = categoryName(type, title);
    fd.set("name", name);
    fd.set("format", format);
    const pesos = fd.get("feePesos");
    fd.delete("feePesos");
    if (pesos) fd.set("entryFeeCents", String(Math.round(Number(pesos) * 100)));
    const result = await addDivisionAction(tournamentId, fd);
    setLoading(false);
    if (result.error) {
      toast.error(
        result.error.includes("duplicate") ? `"${name}" already exists` : result.error
      );
      return;
    }
    toast.success(`Added ${name}`);
    formRef.current?.reset();
    setTitle("");
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-dashed border-umber bg-umber/10 p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-bone">Add a category</p>
        <p className="font-mono text-xs text-muted-foreground">{categoryName(type, title)}</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Type</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category type">
          {CATEGORY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-all duration-200",
                type === t.value
                  ? "border-bone bg-bone text-ink"
                  : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_9rem_9rem_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="category-title">Category title</Label>
          <Input
            id="category-title"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Low Intermediate"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-capacity">How many {entrantNoun(format)}?</Label>
          <Input
            id="category-capacity"
            name="capacity"
            type="number"
            min={2}
            inputMode="numeric"
            defaultValue={16}
            required
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-fee">Fee (₱)</Label>
          <Input
            id="category-fee"
            name="feePesos"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="Default"
            className="font-mono"
          />
        </div>
        <Button type="submit" className="h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
    </form>
  );
}
