"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewWithdrawalRequest } from "@/app/actions/withdrawals";
import { formatPayoutMethodForCopy } from "@/lib/payout-methods/format-clipboard";
import type { PayoutMethodSnapshot, PayoutMethodType } from "@/lib/payout-methods/config";

export function WithdrawalReviewActions({
  requestId,
  payoutSnapshot,
  status,
}: {
  requestId: string;
  payoutSnapshot: Record<string, unknown>;
  status: string;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const pending = status === "pending";

  const snapshot = payoutSnapshot as PayoutMethodSnapshot & { method_type: PayoutMethodType };

  async function copyDetails() {
    const text = formatPayoutMethodForCopy({
      label: String(snapshot.label ?? ""),
      method_type: snapshot.method_type,
      account_name: String(snapshot.account_name ?? ""),
      account_number: String(snapshot.account_number ?? ""),
      bank_name: snapshot.bank_name as string | null,
      notes: snapshot.notes as string | null,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Payout details copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function review(action: "approve" | "reject") {
    setLoading(action);
    const result = await reviewWithdrawalRequest({ requestId, action });
    setLoading(null);
    if (result.error) toast.error(result.error);
    else toast.success(action === "approve" ? "Withdrawal approved" : "Withdrawal rejected");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copyDetails}>
        <Copy />
        Copy payout
      </Button>
      {pending ? (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => review("approve")}
            disabled={loading !== null}
          >
            {loading === "approve" && <Loader2 className="animate-spin" />}
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => review("reject")}
            disabled={loading !== null}
          >
            {loading === "reject" && <Loader2 className="animate-spin" />}
            Reject
          </Button>
        </>
      ) : null}
    </div>
  );
}
