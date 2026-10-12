"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addDivisionAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formats = ["singles", "doubles", "team"] as const;

export function AddDivisionForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [format, setFormat] = useState<(typeof formats)[number]>("doubles");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("format", format);
    const pesos = fd.get("feePesos");
    fd.delete("feePesos");
    if (pesos) fd.set("entryFeeCents", String(Math.round(Number(pesos) * 100)));
    const result = await addDivisionAction(tournamentId, fd);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Added ${fd.get("name")}`);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl border border-dashed border-umber bg-umber/10 p-5"
    >
      <p className="text-sm font-semibold text-bone">Add a division</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_auto_8rem_8rem_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="division-name">Name</Label>
          <Input id="division-name" name="name" required minLength={2} placeholder="Men's Doubles 4.0" />
        </div>
        <div className="space-y-2">
          <Label id="format-label">Format</Label>
          <div
            className="flex h-11 rounded-lg border border-input bg-ink/40 p-1"
            role="radiogroup"
            aria-labelledby="format-label"
          >
            {formats.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  "flex-1 rounded-md px-3 text-sm capitalize transition-colors",
                  format === f ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="division-fee">Fee (₱)</Label>
          <Input
            id="division-fee"
            name="feePesos"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="Default"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="division-capacity">Slots</Label>
          <Input
            id="division-capacity"
            name="capacity"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="No cap"
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
