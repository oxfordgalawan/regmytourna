"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hand, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { claimMatchAction, claimMatchAsSignedInAction } from "@/app/actions/umpire";
import { PinEntry } from "@/components/umpire/pin-entry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GRABBED = "Match grabbed — tap Start match when the players are on court.";

export function ClaimMatchDialog({
  open,
  onOpenChange,
  tournamentId,
  matchLabel,
  matchId,
  signedIn = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  matchId: string | null;
  matchLabel: string;
  /** signed-in umpires just confirm; others enter their PIN */
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // claiming only reserves the match; the umpire starts it when players are on court
  function claimed() {
    onOpenChange(false);
    toast.success(GRABBED);
    router.refresh();
  }

  async function confirm() {
    if (!matchId || busy) return;
    setBusy(true);
    const res = await claimMatchAsSignedInAction(tournamentId, matchId);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      if (res.error.includes("expired")) router.refresh();
      return;
    }
    claimed();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Grab match</DialogTitle>
          <DialogDescription>{matchLabel}</DialogDescription>
        </DialogHeader>
        {matchId &&
          (signedIn ? (
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Hand />}
                Grab match
              </Button>
            </DialogFooter>
          ) : (
            <PinEntry
              label="Enter your 4-digit umpire PIN"
              onSubmit={async (pin) => {
                const res = await claimMatchAction(tournamentId, matchId, pin);
                if (res.error) return { error: res.error };
                claimed();
              }}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
