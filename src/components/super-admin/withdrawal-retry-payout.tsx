"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { retryPaymongoWithdrawalPayout } from "@/app/actions/withdrawals";
import { Button } from "@/components/ui/button";
import { formatPhp } from "@/lib/format";

export function WithdrawalRetryPayout({
  requestId,
  amountCents,
  organizerName,
}: {
  requestId: string;
  amountCents: number;
  organizerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await retryPaymongoWithdrawalPayout({ requestId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.transferId ? `PayMongo transfer ${res.transferId} submitted for ${organizerName}.` : "Payout submitted."
      );
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        <RefreshCw />
        Retry PayMongo payout
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-brass">Send {formatPhp(amountCents)} via PayMongo?</span>
      <Button size="sm" disabled={pending} onClick={run}>
        {pending && <Loader2 className="animate-spin" />}
        Confirm send
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}