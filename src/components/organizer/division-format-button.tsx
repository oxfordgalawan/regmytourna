"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Settings2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updateDivisionFormatAction } from "@/app/actions/brackets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormatPicker } from "@/components/organizer/format-picker";
import { describeFormat, type BracketConfig } from "@/lib/bracket-format";
import type { TrimPreview } from "@/lib/scoring/reconcile-games-to-win";

/** Format summary for one category, with a dialog to change it. */
export function DivisionFormatButton({
  divisionId,
  name,
  teams,
  noun,
  config,
  bracketState,
  challongeLocked,
}: {
  divisionId: string;
  name: string;
  teams: number;
  noun: string;
  config: BracketConfig;
  bracketState: string;
  /** Challonge mirror locked — structural preset changes blocked. */
  challongeLocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [trimPreview, setTrimPreview] = useState<TrimPreview | null>(null);
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);
  const info = describeFormat(config, teams);
  const playStarted = bracketState !== "not_started";
  const layoutLocked = playStarted || challongeLocked;

  async function save(confirmTrim = false) {
    setSaving(true);
    const result = await updateDivisionFormatAction(divisionId, draft, { confirmTrim });
    setSaving(false);
    if ("needsConfirm" in result && result.needsConfirm) {
      setTrimPreview(result.preview);
      setTrimOpen(true);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.bracketExists
        ? "Format saved. Recreate the Challonge bracket to apply it there."
        : "Format saved"
    );
    setOpen(false);
    setTrimOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(config);
          setOpen(true);
        }}
        title={layoutLocked ? "Fine-tune scoring and tiebreakers" : "Change format"}
        className="group flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-espresso"
      >
        {layoutLocked ? (
          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Settings2 className="size-3.5 shrink-0 text-brass" />
        )}
        <span>
          <span className="block text-sm whitespace-nowrap text-bone">{info.name}</span>
          <span className="block font-mono text-[0.7rem] whitespace-nowrap text-muted-foreground">
            {info.matches} · {info.scoring}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-5xl xl:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{name}</DialogTitle>
            <DialogDescription>
              Sized for {teams} {noun}.{" "}
              {playStarted
                ? "Preset and pool layout are locked while play is underway; Best of and tiebreakers can still change."
                : "Change it any time until play starts."}
            </DialogDescription>
          </DialogHeader>
          <FormatPicker value={draft} onChange={setDraft} teams={teams} noun={noun} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => save()} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save format
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trimOpen} onOpenChange={setTrimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove extra games?</DialogTitle>
            <DialogDescription>
              Lowering Best of will trim extra recorded games from {trimPreview?.toUpdate ?? 0} match
              {(trimPreview?.toUpdate ?? 0) === 1 ? "" : "es"} and recalculate pool standings.
              {(trimPreview?.winnerChanges ?? 0) > 0
                ? ` ${trimPreview!.winnerChanges} match${trimPreview!.winnerChanges === 1 ? "" : "es"} will get a new winner based on the first game only.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTrimOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => save(true)}
              disabled={saving || !trimPreview?.toUpdate}
            >
              {saving && <Loader2 className="animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
