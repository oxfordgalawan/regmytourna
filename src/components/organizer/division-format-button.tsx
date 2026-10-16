"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Settings2 } from "lucide-react";
import { toast } from "sonner";
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

/** Format summary for one category, with a dialog to change it. */
export function DivisionFormatButton({
  divisionId,
  name,
  teams,
  noun,
  config,
  locked,
}: {
  divisionId: string;
  name: string;
  teams: number;
  noun: string;
  config: BracketConfig;
  locked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);
  const info = describeFormat(config, teams);

  async function save() {
    setSaving(true);
    const result = await updateDivisionFormatAction(divisionId, draft);
    setSaving(false);
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
        disabled={locked}
        title={locked ? "Play has started — format is locked" : "Change format"}
        className="group flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-espresso disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        {locked ? (
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
              Sized for {teams} {noun}. Change it any time until play starts.
            </DialogDescription>
          </DialogHeader>
          <FormatPicker value={draft} onChange={setDraft} teams={teams} noun={noun} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save format
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
