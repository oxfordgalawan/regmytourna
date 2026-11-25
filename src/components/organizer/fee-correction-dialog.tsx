"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  applyFeeCorrection,
  previewFeeCorrection,
  type FeeCorrectionPreviewRow,
} from "@/app/actions/fee-correction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";

export function FeeCorrectionDialog({
  tournamentId,
  open,
  onOpenChange,
  onApplied,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const [rows, setRows] = useState<FeeCorrectionPreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState(
    "We apologize for the confusion — the registration fee was listed per team instead of per player. Thank you for your patience."
  );
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    previewFeeCorrection(tournamentId).then((res) => {
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        setRows([]);
        return;
      }
      setRows(res.rows);
      setSelected(new Set(res.rows.map((r) => r.registrationId)));
    });
  }, [open, tournamentId]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(rows.map((r) => r.registrationId)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function toggleAll() {
    if (allSelected) clearAll();
    else selectAll();
  }

  function confirm() {
    const ids = [...selected];
    if (!ids.length) {
      toast.error("Select at least one entry");
      return;
    }
    startTransition(async () => {
      const res = await applyFeeCorrection({
        tournamentId,
        registrationIds: ids,
        organizerNote: note,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked ${res.markedPartial} partial · ${res.emailed} emails sent`);
      onOpenChange(false);
      onApplied?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-brass" />
            Request balance payments
          </DialogTitle>
          <DialogDescription>
            Choose one team or all. Selected entries are marked <strong>partial</strong> and captains receive the balance-due email (pay from My entries).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading underpaid entries…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No underpaid paid entries found for this event.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-bone">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
                Select all ({rows.length})
              </label>
              <span className="text-xs text-muted-foreground">
                {selected.size} of {rows.length} selected
              </span>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-brass underline-offset-2 hover:underline" onClick={selectAll}>
                  All
                </button>
                <span className="text-muted-foreground">·</span>
                <button type="button" className="text-brass underline-offset-2 hover:underline" onClick={clearAll}>
                  None
                </button>
              </div>
            </div>
            <ul className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-line bg-ink/30 p-2">
            {rows.map((r) => (
              <li key={r.registrationId}>
                <label className="flex cursor-pointer gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(r.registrationId)}
                    onChange={() => toggle(r.registrationId)}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium text-bone">{r.teamName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.divisionName} · paid {formatPhp(r.paidCents)} · due {formatPhp(r.balanceDueCents)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            </ul>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Note in email (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-ink/40 px-3 py-2 text-sm text-bone outline-none focus-visible:border-brass"
          />
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={pending || loading || !rows.length || selected.size === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Mail />}
            Send to {selected.size || "…"} {selected.size === 1 ? "team" : "teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}