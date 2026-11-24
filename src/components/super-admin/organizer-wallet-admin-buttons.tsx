"use client";

import { useEffect, useState, useTransition } from "react";
import { HandCoins, Loader2, Scale } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  creditNegativeBalanceShortfall,
  getOrganizerWalletAdminOptions,
  waiveLegacyCashFeesForOrganizer,
} from "@/app/actions/super-admin-wallet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";

type AdminOptions = Awaited<ReturnType<typeof getOrganizerWalletAdminOptions>>;

export function OrganizerWalletAdminButtons({
  organizerId,
  balanceCents,
  platformFeePercent,
}: {
  organizerId: string;
  balanceCents: number;
  platformFeePercent: number | null;
}) {
  const [options, setOptions] = useState<Extract<AdminOptions, { balanceCents: number }> | null>(
    null
  );
  const [dialog, setDialog] = useState<"waive" | "shortfall" | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (platformFeePercent !== 0 || balanceCents >= 0) {
      setOptions(null);
      return;
    }
    start(async () => {
      const res = await getOrganizerWalletAdminOptions(organizerId);
      if ("error" in res) return;
      setOptions(res);
    });
  }, [organizerId, balanceCents, platformFeePercent]);

  if (platformFeePercent !== 0 || balanceCents >= 0) {
    return null;
  }

  const waiveAmount = options?.platformFeeDebitCents ?? 0;
  const shortfallAmount = options?.shortfallCreditCents ?? 0;

  function confirm() {
    if (!dialog) return;
    start(async () => {
      const res =
        dialog === "waive"
          ? await waiveLegacyCashFeesForOrganizer({ organizerUserId: organizerId })
          : await creditNegativeBalanceShortfall({ organizerUserId: organizerId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Credited ${formatPhp(res.creditedCents)} to wallet.`);
      setDialog(null);
      const fresh = await getOrganizerWalletAdminOptions(organizerId);
      if (!("error" in fresh)) setOptions(fresh);
    });
  }

  return (
    <div className="mt-1 space-y-1">
      {!options && pending ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
      ) : null}

      {options?.canWaiveLegacyCashFees ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => setDialog("waive")}
        >
          <HandCoins className="size-4" />
          Waive legacy cash fees
        </Button>
      ) : null}

      {options?.canCreditShortfall ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => setDialog("shortfall")}
        >
          <Scale className="size-4" />
          Credit balance shortfall
        </Button>
      ) : null}

      {options &&
      !options.canWaiveLegacyCashFees &&
      !options.canCreditShortfall &&
      balanceCents < 0 ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          No cash fees to waive. Review Wallet → Activity (often a refund after a withdrawal).
        </p>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogTitle>
            {dialog === "waive" ? "Waive legacy cash fees" : "Credit balance shortfall"}
          </DialogTitle>
          <DialogDescription>
            {dialog === "waive" ? (
              <>
                One-time adjustment for historical cash convenience fee debits:{" "}
                <span className="font-mono text-bone">{formatPhp(waiveAmount)}</span>.
              </>
            ) : (
              <>
                No legacy cash fees on this ledger — the negative balance is usually a refund after
                a payout. Credit{" "}
                <span className="font-mono text-bone">{formatPhp(shortfallAmount)}</span> to bring
                available balance to ₱0.
              </>
            )}
          </DialogDescription>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}