"use client";

import { useState } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Loader2 } from "lucide-react";
import { createQuickScoreSessionAction } from "@/app/actions/quick-score";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterChips } from "@/components/ui/filter-chips";
import { cn } from "@/lib/utils";

export function QuickScoreSetupForm() {
  const [format, setFormat] = useState<"singles" | "doubles">("doubles");
  const [bestOf, setBestOf] = useState<"1" | "3">("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doubles = format === "doubles";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("format", format);
    fd.set("bestOf", bestOf);
    try {
      const result = await createQuickScoreSessionAction(fd);
      if (result?.error) {
        setError(result.error);
        setBusy(false);
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setError(err instanceof Error ? err.message : "Could not start scoring.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Match label (optional)</Label>
        <Input id="title" name="title" placeholder="Court 3 · Club night" autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <FilterChips
          label="Format"
          chips={[
            { key: "singles", label: "Singles", active: format === "singles", onSelect: () => setFormat("singles") },
            { key: "doubles", label: "Doubles", active: format === "doubles", onSelect: () => setFormat("doubles") },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label>Match length</Label>
        <FilterChips
          label="Best of"
          chips={[
            { key: "1", label: "Best of 1", active: bestOf === "1", onSelect: () => setBestOf("1") },
            { key: "3", label: "Best of 3", active: bestOf === "3", onSelect: () => setBestOf("3") },
          ]}
        />
      </div>

      <SideNameFields doubles={doubles} />

      {error ? <p className="text-sm text-rust">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {busy ? "Starting…" : "Start scoring"}
      </Button>
    </form>
  );
}

function SideNameFields({ doubles }: { doubles: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <fieldset className={cn("space-y-3 rounded-xl border border-line p-4")}>
        <legend className="px-1 text-sm font-medium text-bone">Side A</legend>
        <div className="space-y-2">
          <Label htmlFor="a1">{doubles ? "Player 1" : "Name"}</Label>
          <Input id="a1" name="a1" required autoComplete="off" />
        </div>
        {doubles ? (
          <div className="space-y-2">
            <Label htmlFor="a2">Player 2</Label>
            <Input id="a2" name="a2" required autoComplete="off" />
          </div>
        ) : null}
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-medium text-bone">Side B</legend>
        <div className="space-y-2">
          <Label htmlFor="b1">{doubles ? "Player 1" : "Name"}</Label>
          <Input id="b1" name="b1" required autoComplete="off" />
        </div>
        {doubles ? (
          <div className="space-y-2">
            <Label htmlFor="b2">Player 2</Label>
            <Input id="b2" name="b2" required autoComplete="off" />
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}