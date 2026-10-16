"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { claimMatchAction } from "@/app/actions/umpire";
import { PinEntry } from "@/components/umpire/pin-entry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ClaimMatchDialog({
  open,
  onOpenChange,
  tournamentId,
  matchLabel,
  matchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  matchId: string | null;
  matchLabel: string;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Claim match</DialogTitle>
          <DialogDescription>{matchLabel}</DialogDescription>
        </DialogHeader>
        {matchId && (
          <PinEntry
            label="Enter your 4-digit umpire PIN"
            onSubmit={async (pin) => {
              const res = await claimMatchAction(tournamentId, matchId, pin);
              if (res.error) return { error: res.error };
              // claiming only reserves the match; the umpire starts it when players are on court
              onOpenChange(false);
              toast.success("Match claimed — tap Start match when the players are on court.");
              router.refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
