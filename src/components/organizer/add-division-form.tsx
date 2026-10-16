"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addDivisionAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORY_TYPES,
  categoryName,
  categoryType,
  entrantNoun,
  type CategoryType,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

/** "Add category" button + modal (same fields as the create form). */
export function AddDivisionForm({
  tournamentId,
  showFee = true,
  label = "Add category",
}: {
  tournamentId: string;
  /** bracket-only events don't charge fees */
  showFee?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CategoryType>("mens_doubles");
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState("16");
  const [fee, setFee] = useState("");
  const [loading, setLoading] = useState(false);
  const format = categoryType(type).format;
  const name = categoryName(type, title);

  function reset() {
    setTitle("");
    setCapacity("16");
    setFee("");
  }

  async function save(keepOpen: boolean) {
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("format", format);
    fd.set("capacity", capacity);
    if (showFee && fee) fd.set("entryFeeCents", String(Math.round(Number(fee) * 100)));
    if (!showFee) fd.set("entryFeeCents", "0");
    const result = await addDivisionAction(tournamentId, fd);
    setLoading(false);
    if (result.error) {
      toast.error(
        typeof result.error === "string" && result.error.includes("duplicate")
          ? `"${name}" already exists`
          : typeof result.error === "string"
            ? result.error
            : "Please check the fields and try again."
      );
      return;
    }
    toast.success(`Added ${name}`);
    reset();
    router.refresh();
    if (!keepOpen) setOpen(false);
  }

  const ready = Number(capacity) >= 2;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-lg">
          <div className="border-b border-line px-5 pt-5 pb-4">
            <DialogTitle className="text-base text-bone">Add a category</DialogTitle>
            <DialogDescription>Each category is its own bracket.</DialogDescription>
          </div>

          <form
            className="space-y-5 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void save(false);
            }}
          >
            <div className="space-y-2">
              <span className="text-sm font-medium text-bone">Type</span>
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

            <div className="space-y-2">
              <Label htmlFor="category-title">Category title</Label>
              <Input
                id="category-title"
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Low Intermediate"
                autoFocus
              />
            </div>

            <div className={cn("grid gap-4", showFee && "grid-cols-2")}>
              <div className="space-y-2">
                <Label htmlFor="category-capacity">How many {entrantNoun(format)}?</Label>
                <Input
                  id="category-capacity"
                  type="number"
                  min={2}
                  inputMode="numeric"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
              {showFee && (
                <div className="space-y-2">
                  <Label htmlFor="category-fee">Fee (₱)</Label>
                  <Input
                    id="category-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="Event default"
                    className="font-mono"
                  />
                </div>
              )}
            </div>

            {/* live preview of what gets created */}
            <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-4 py-3">
              <span className="rounded-md bg-umber px-1.5 py-0.5 font-mono text-[0.65rem] text-bone">
                {categoryType(type).short}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-bone">{name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {capacity || 0} {entrantNoun(format, Number(capacity) || 2)}
              </span>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={loading || !ready} onClick={() => void save(true)}>
                Save &amp; add another
              </Button>
              <Button type="submit" disabled={loading || !ready}>
                {loading ? <Loader2 className="animate-spin" /> : <Plus />}
                Add category
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
