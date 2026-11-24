"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cancelTournamentAction, deleteTournamentAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/ui/app-toast";
import { cn } from "@/lib/utils";
import type { TournamentStatus } from "@/types/database";

type ConfirmKind = "cancel" | "delete";

export function TournamentDangerZone({
  tournamentId,
  status,
  canDelete,
}: {
  tournamentId: string;
  status: TournamentStatus;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  function run(kind: ConfirmKind) {
    start(async () => {
      const res =
        kind === "cancel"
          ? await cancelTournamentAction(tournamentId)
          : await deleteTournamentAction(tournamentId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setConfirm(null);
      if (kind === "cancel") {
        toast.success("Event cancelled — it's hidden from public listings.");
        router.refresh();
        return;
      }
      toast.success("Event deleted.");
      router.push(res.redirect ?? "/organizer/tournaments");
    });
  }

  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";
  const showCancel = !isDraft && !isCancelled;
  const showDelete = canDelete;

  if (!showCancel && !showDelete && !isCancelled) return null;

  return (
    <>
      <section
        className={cn(
          "space-y-4 rounded-2xl border border-rust/30 bg-rust/5 p-5 sm:p-6",
          "ring-1 ring-rust/10"
        )}
      >
        <div>
          <h2 className="text-lg font-semibold text-bone">Close or remove this event</h2>
          {isCancelled ? (
            <p className="mt-1 text-sm text-muted-foreground">
              This event is cancelled and unlisted. Confirmed entries and payment history are kept for your records.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {showCancel
                ? "Cancelling unlists the event and stops new registrations. Existing paid entries stay on record."
                : null}
              {showCancel && showDelete ? " " : null}
              {showDelete
                ? "Permanent delete only works when there are no payments or wallet transactions."
                : !showCancel
                  ? "This event has financial history — cancel it to hide it from public listings."
                  : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {showCancel && (
            <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirm("cancel")}>
              Cancel event
            </Button>
          )}
          {showDelete && (
            <Button
              type="button"
              variant={showCancel ? "outline" : "destructive"}
              disabled={pending}
              onClick={() => setConfirm("delete")}
            >
              Delete permanently
            </Button>
          )}
        </div>
      </section>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>{confirm === "delete" ? "Delete this event?" : "Cancel this event?"}</DialogTitle>
          <DialogDescription>
            {confirm === "delete"
              ? "This removes the event and all divisions, brackets, and unpaid entries. This cannot be undone."
              : "The event will be unlisted and registration stops. Unpaid entries are cleared. Paid entries and wallet history stay intact."}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>
              Keep event
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => confirm && run(confirm)}
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirm === "delete" ? "Delete permanently" : "Cancel event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}