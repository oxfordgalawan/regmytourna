"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { reviewWithdrawalRequest } from "@/app/actions/withdrawals";
import { formatPayoutMethodForCopy } from "@/lib/payout-methods/format-clipboard";
import { methodTypeLabel, type PayoutMethodSnapshot, type PayoutMethodType } from "@/lib/payout-methods/config";
import { formatPhp } from "@/lib/format";

/** Copy one payout field with a tap (account number, name…). */
export function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Could not copy");
        }
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-ink/40"
    >
      <span className="min-w-0">
        <span className="block text-[0.65rem] tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className={mono ? "block truncate font-mono text-sm text-bone" : "block truncate text-sm text-bone"}>{value}</span>
      </span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-brass" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

/** Approve (after sending the money) or decline (money goes back to their balance) — each in a modal. */
export function WithdrawalReviewActions({
  requestId,
  amountCents,
  organizerName,
  payoutSnapshot,
}: {
  requestId: string;
  amountCents: number;
  organizerName: string;
  payoutSnapshot: Record<string, unknown>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const snap = payoutSnapshot as PayoutMethodSnapshot & { method_type: PayoutMethodType };

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(
        formatPayoutMethodForCopy({
          label: String(snap.label ?? ""),
          method_type: snap.method_type,
          account_name: String(snap.account_name ?? ""),
          account_number: String(snap.account_number ?? ""),
          bank_name: (snap.bank_name as string | null) ?? null,
          notes: (snap.notes as string | null) ?? null,
        })
      );
      toast.success("Payout details copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function submit() {
    if (!mode) return;
    startTransition(async () => {
      const res = await reviewWithdrawalRequest({ requestId, action: mode, note });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "approve" ? "Marked as sent" : "Declined — returned to their balance");
      setMode(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copyAll}>
          <Copy />
          Copy details
        </Button>
        <Button size="sm" onClick={() => setMode("approve")}>
          <Check />
          Approve
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("reject")}>
          <X />
          Decline
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !pending && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{mode === "approve" ? `Send ${formatPhp(amountCents)}` : "Decline withdrawal"}</DialogTitle>
          <DialogDescription>
            {mode === "approve"
              ? `Send the money to ${organizerName}'s ${methodTypeLabel(snap.method_type)} first, then confirm here. They'll be emailed.`
              : `${formatPhp(amountCents)} goes back to ${organizerName}'s available balance. Tell them why.`}
          </DialogDescription>
          {mode === "approve" && (
            <div className="rounded-xl border border-line bg-ink/40 p-2">
              <CopyField label="Account name" value={String(snap.account_name ?? "")} />
              <CopyField label={snap.method_type === "bank" ? "Account number" : "Number"} value={String(snap.account_number ?? "")} mono />
              {snap.bank_name ? <CopyField label="Bank" value={String(snap.bank_name)} /> : null}
              <CopyField label="Amount" value={(amountCents / 100).toFixed(2)} mono />
            </div>
          )}
          <div className="space-y-2">
            {mode === "approve" ? (
              <>
                <Label htmlFor="wr-note">Reference number (optional)</Label>
                <Input id="wr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. GCash ref 1234 5678 9" />
              </>
            ) : (
              <>
                <Label htmlFor="wr-note">Reason</Label>
                <Textarea
                  id="wr-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. The account name doesn't match — please update your payout method."
                />
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={pending || (mode === "reject" && note.trim().length < 5)}
              onClick={submit}
            >
              {pending && <Loader2 className="animate-spin" />}
              {mode === "approve" ? "I've sent it — approve" : "Decline"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
