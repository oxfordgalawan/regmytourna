"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  movePlayersToDivisionAction,
  moveRegistrationToDivisionAction,
} from "@/app/actions/organizer-entry-moves";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WalkInCategory } from "@/components/organizer/walk-in-dialogs";

export type MoveEntryTarget = {
  registrationId: string;
  divisionId: string;
  divisionName: string;
  doubles: boolean;
  players: Array<{ rowId: string; name: string; primary: boolean }>;
};

export function MoveEntryDialog({
  categories,
  target,
  onClose,
}: {
  categories: WalkInCategory[];
  target: MoveEntryTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetDivisionId, setTargetDivisionId] = useState("");
  const [mode, setMode] = useState<"entire" | "players">("entire");
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(
    () =>
      categories.filter(
        (c) => c.id !== target.divisionId && !c.drawStarted
      ),
    [categories, target.divisionId]
  );

  const targetCategory = options.find((c) => c.id === targetDivisionId);
  const canPickPlayers = target.doubles && target.players.length > 1;

  function togglePlayer(rowId: string) {
    setSelected((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  }

  function save() {
    if (!targetDivisionId) {
      toast.error("Choose a category.");
      return;
    }
    startTransition(async () => {
      if (mode === "entire" || !canPickPlayers) {
        const res = await moveRegistrationToDivisionAction(target.registrationId, targetDivisionId);
        if (res.error) return toast.error(res.error);
        toast.success(`Moved to ${targetCategory?.name ?? "category"}`);
      } else {
        if (!selected.length) return toast.error("Select at least one player.");
        if (selected.length >= target.players.length) {
          return toast.error("To move everyone, use Move entire entry.");
        }
        if ((targetCategory?.feeCents ?? 0) > 0) {
          toast.message("New entries in the target category will need their own payment.");
        }
        const res = await movePlayersToDivisionAction(target.registrationId, targetDivisionId, selected);
        if (res.error) return toast.error(res.error);
        toast.success("Player(s) moved.");
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Move to another category</DialogTitle>
          <DialogDescription>
            From <strong className="text-bone">{target.divisionName}</strong>. Draws must not have started in either category.
          </DialogDescription>
        </DialogHeader>

        {canPickPlayers && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-bone">What to move?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["entire", "Entire entry", "Payment and slot stay together"],
                  ["players", "Selected players", "New entries in the target category"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    if (value === "entire") setSelected([]);
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    mode === value ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                  )}
                >
                  <span className="block text-sm font-medium text-bone">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {mode === "players" && canPickPlayers && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-bone">Players</legend>
            {target.players.map((p) => (
              <label key={p.rowId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.includes(p.rowId)}
                  onChange={() => togglePlayer(p.rowId)}
                  className="size-4 rounded border-line"
                />
                <span className="text-sm text-bone">
                  {p.name}
                  {p.primary ? " · captain" : ""}
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Anyone left on the original entry may show as needing a partner.
            </p>
          </fieldset>
        )}

        <div className="space-y-2">
          <Label>Target category</Label>
          <div className="grid gap-2" role="radiogroup" aria-label="Target category">
            {options.map((c) => {
              const full = c.capacity !== null && c.taken >= c.capacity;
              const disabled =
                full ||
                (mode === "entire" && target.doubles && c.format !== "doubles") ||
                (mode === "entire" && !target.doubles && c.format === "doubles");
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={targetDivisionId === c.id}
                  disabled={disabled}
                  onClick={() => setTargetDivisionId(c.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    targetDivisionId === c.id ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-bone">{c.name}</span>
                    <span className="block text-xs text-muted-foreground capitalize">
                      {disabled && !full && target.doubles !== (c.format === "doubles")
                        ? "Format doesn't match"
                        : full
                          ? "Full"
                          : c.capacity
                            ? `${c.capacity - c.taken} slots left`
                            : "No limit"}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-bone/80">{formatPhp(c.feeCents)}</span>
                </button>
              );
            })}
          </div>
          {!options.length && (
            <p className="text-sm text-muted-foreground">No other categories available (draw may have started).</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !targetDivisionId}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}